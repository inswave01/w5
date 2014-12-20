function ViewModel(option, colModel, view, data, style) {
  this.option = new Backbone.Model(this.optionDefaultObject);
  this.colModel = colModel;
  this.view = view;
  this.collection = data;
  this.colLinker = {};
  this.colInvertLinker = [];
  this.table  = new this.MetaModel({id : 'table'}, {rowCID : "*", colID : "*"});
  this.column = new Backbone.Collection(null, {model : this.MetaModel});
  this.row    = new Backbone.Collection(null, {model : this.MetaModel});
  this.cell   = new Backbone.Collection(null, {model : this.MetaModel});
  this.groupInfo = {
    grouped: false,
    groupRowCIDs: [],
    subTotalPosition: 'header'
  };

  _(colModel).each( function ( model, index ) {
    var id = model.id || model.headerLabel;
    if(!id) {
      throw new Error( "The column should be assigned one of id or headerLable." );
    }
    this.colLinker[id] = index;
    this.colInvertLinker[index] = id;
  }, this);
  if(!option.colOrder) {
    option.colOrder = this.colInvertLinker.slice();
  }

  this.option.set(option);

  _(colModel).each(function(model, index) {
    _.chain(model).each( function( value, key ) {
      if( key !== 'id' ) {
        this.setMeta( ["*", index], key, value, {inorder:true} );
      }
    }, this);
  }, this);

  _.each(style || [], function(meta) {
    this.setMeta( [meta[0], meta[1]], "style", meta[2]);
  }, this);
}

_.extend( ViewModel.prototype, {
  optionDefaultObject: {
    scrollLeft : 0,
    scrollTop : 0,
    frozenColumn : 0,
    selectionMode : "cell",
    rowNum : 10
  },
  metaDefaultObject: {
    width : 100,
    headerLabel : "",
    readonly : false,
    disabled : false,
    displayType : "text",
    options : null,
    hidden : false,
    dataType : null,
    format : "",
    className : ""
  },
  metaDataTypes: {
    style : "object",
    option : "object",
    className : "className",
    disabled : true,
    readOnly : true,
    displayType : true,
    options : true
  },
  MetaModel: Backbone.Model.extend({
    initialize : function(attributes, options) {
      this.rowCID = options.rowCID;
      this.colID = options.colID;
      if(this.rowCID === "*" && this.colID === "*") {
        this.type = "table";
      } else if(this.rowCID === "*") {
        this.type = "column";
      } else if(this.colID === "*") {
        this.type = "row";
      } else {
        this.type = "cell";
      }
    }
  }),
  getModel: function(rowCID, colID, makeModel) {
    var collection, key, model;
    if( rowCID === "*" && colID === "*" ) {
      return this.table;
    }

    if( rowCID === "*" ) {
      key = colID;
      collection = this.column;
    } else if( colID === "*" ) {
      key = rowCID;
      collection = this.row;
    } else {
      key = rowCID + "," + colID;
      collection = this.cell;
    }
    model = collection.get(key) || null;
    if(!model && makeModel) {
      model = new this.MetaModel({id : key}, {rowCID : rowCID, colID : colID});
      collection.push(model);
    }
    return model;
  },
  setData: function ( pos, value, options ) {
    var models,
        rst, i, dataType;

    options = options || {};
    if ( this.collection.__validator && _.isUndefined(options.validate) ) {
      options.validate = true;
    }
    pos[1] = this.getColID(pos[1], options.inorder );

    if ( pos[0] === "*" && pos[1] === "*" ) {
      models = this.collection.reset(value, options);
    } else if ( pos[1] === "*" ) {
      value = this.checkDataType( value );
      for(i in value) {
        dataType = this.getMeta([pos[0], i], "dataType");
        if(dataType) {
          value[i] = w5.dataType[dataType](value[i]);
        }
      }
      models = this.collection.at(pos[0]).set( value, options );
    } else if ( pos[0] === "*" ) {
      options.save = false;
      options.targetColumn = pos[1];
      (this.collection).find( function( row, index ) {
        if ( _(value).isArray() && index >= value.length ) {
          return;
        }
        var val = _(value).isArray() ? value[index] : value;
        dataType = this.getMeta([index, pos[1]], "dataType");
        if ( dataType ) {
          val = w5.dataType[dataType]( val );
        }
        rst = row.set( pos[1], val, options );

        return rst === false;
      }, this);
    } else {
      dataType = this.getMeta([pos[0], pos[1]], "dataType");
      if(dataType) {
        value = w5.dataType[dataType](value);
      }
      models = this.collection.at(pos[0]).set( pos[1], value, options );
    }

    if ( options.save === true ) {
      this.save( models, options );
    }
  },
  checkNegativeValue: function ( value ) {
    return _.isUndefined(value) || _.isNull(value) || value === '';
  },
  getCheckValue: function ( options ) {
    var col,
        checkedValue;

    options = options || {};
    col = options.col || 0;
    checkedValue = this.getMeta( ['*', col], 'options', options );

    if ( checkedValue && _.isArray(checkedValue) ) {
      checkedValue = checkedValue[0].value;
      if ( this.checkNegativeValue( checkedValue ) ) {
        checkedValue = null;
      }
    } else {
      checkedValue = null;
    }

    return checkedValue;
  },
  runExpression: function( expression, rowIndex, colId ) {
    return expression.call( this.view, {
      rowIndex: rowIndex,
      colId: colId,
      attributes: this.collection.at(rowIndex).toJSON()
    });
  },
  getCellData: function( rowIndex, colId, options ) {
    var data,
        expression = this.getMeta( [rowIndex, colId], "expression" );

    if ( _.isFunction( expression ) ) {
      expression = this.runExpression( expression, rowIndex, colId );

      if( _.isFunction( expression ) ) {
        this.setMeta( [rowIndex, colId], "expression", expression, { silent: true } );
        data = this.runExpression( expression, rowIndex, colId );
      } else {
        data = expression;
      }
    } else if ( _.isString(expression) && this.evalExpression ) {
      data = this.evalExpression( rowIndex, colId, expression );
    } else {
      data = this.collection.at(rowIndex).get(colId);
    }
    return options.formatted === true ? cellProto.getFormattedData( data, rowIndex, colId, this.view ) : data;
  },
  getData: function ( pos, options ) {
    options = options || {};
    var isArray = options.type && options.type.toLowerCase() === 'array',
        singular, models, ret,
        checkedValue, modelValue,
        keys, values;

    pos[1] = this.getColID(pos[1], options.inorder);
    if ( pos[1] === "*" ) {
      singular = pos[0] !== "*";
      models = singular ? [this.collection.at(pos[0])] : this.collection.models;

      if ( options.checked ) {
        checkedValue = this.getCheckValue( options );
        if ( checkedValue === null ) {
          return [];
        }
      }

      ret = _.reduce( models, function ( list, model ) {
        if ( options.checked ) {
          modelValue = model.get( this.getColID( 0, options.inorder ) );
          if ( _.isUndefined(modelValue) || _.isNull(modelValue) || modelValue.indexOf(checkedValue) === -1 ) {
            return list;
          }
        }

        if ( options.pick === true || isArray ) {
          keys = this.colInvertLinker;
        } else if ( options.pick ) {
          keys = _.intersection( this.colInvertLinker, options.pick );
        } else if ( options.omit ) {
          keys = _.difference( this.colInvertLinker, options.omit );
        } else {
          keys = model.keys();
        }

        values = _.map(keys, function(col) {
          return this.getCellData( model.collection.indexOf(model), col, options );
        }, this );

        if ( isArray ) {
          list.push( values );
        } else {
          list.push( _.object(keys, values) );
        }

        return list;
      }, [], this );

      if ( singular ) {
        return ret[0];
      }
      return ret;
    } else if ( pos[0] === "*" ) {
      return this.collection.map(function (row, rowIndex) {
        return this.getCellData( rowIndex, pos[1], options );
      }, this);
    }
    return this.getCellData( pos[0], pos[1], options );
  },
  getDataLength: function () {
    return this.collection.length;
  },
  getDataCID: function (pos) {
    if(pos === "*" || _(pos).isString()) {
      return pos;
    }
    return this.collection.at(pos).cid;
  },
  getMetaIndex: function (id) {
    return this.collection.indexOf( this.collection.get(id) );
  },
  setMeta: function ( pos, prop, value, options ) {
    options = options || {};
    pos[1] = this.getColID(pos[1], options.inorder);
    var model = this.getModel(this.getDataCID(pos[0]), pos[1], true);
    var obj = {
      uid : _.uniqueId()
    };
    if( options.alter && model.has(prop) ) {
      obj = model.get( prop );
    }
    obj.value = ( prop === 'width' || prop === 'height' ) ? parseInt( value, 10 ) : value;

    model.set( prop, prop === 'id' ? value : obj, options); 
  },
  getMeta: function ( pos, prop, options ) {
    var cid = this.getDataCID(pos[0]),
        model,
        ret,
        metaArr;

    options = options || {};
    pos[1] = this.getColID( pos[1], options.inorder );
    model = this.getModel( cid, pos[1] );

    if ( (pos[0] === "*" || pos[1] === "*") || options.noncomputed ) {
      if(model && model.has(prop)) {
        ret = _.isObject(model.get(prop)) ? model.get(prop).value : model.get(prop);
      } else {
        ret = this.metaDefaultObject[prop];
      }
    } else {
      metaArr = _([
        model,
        this.getModel( "*", pos[1] ),
        this.getModel( cid, "*" ),
        this.getModel( "*", "*" )
      ]).compact();
      metaArr = _(_.map( metaArr, function (model) {
        return model.get(prop);
      })).compact();
      if(metaArr.length === 0) {
        metaArr = [{
          uid : -1,
          value : this.metaDefaultObject[prop] 
        }];
      }
      switch(this.metaDataTypes[prop]) {
      case "object": 
        metaArr = _(metaArr).sortBy(function(obj) {
          return parseInt(obj.uid, 10);
        });
        ret = _(metaArr).reduce(function(memo, obj) {
          return _.extend(memo, obj.value);
        }, {});
        break;
      case "className":
        ret = _.union(_.pluck(metaArr, "value").join(" ").split(/\s+/)).join(" ");
        break;
      default:
        ret = _.max(metaArr, function(obj) {
          return parseInt(obj.uid, 10);
        }).value;    
      }
    }
    return ret;
  },
  hasMeta: function ( pos, prop, value, options ) {
    options =  options || {};
    pos[1] = this.getColID(pos[1], options.inorder);
    var model = this.getModel(this.getDataCID(pos[0]), pos[1]);

    return !!model && model.has(prop);
  },
  removeMeta: function ( pos, prop, options ) {
    options = options || {};
    pos[1] = this.getColID( pos[1], options.inorder );
    var model = this.getModel( this.getDataCID(pos[0]), pos[1] );

    if ( model ) {
      model.unset( prop, options );
    }
  },
  removeMetaByDataCID: function (cid) {
    var keepLength = this.cell.length,
        filteredMeta = _.filter( this.cell.models, function (model) {
          return model.id.indexOf(cid) === -1;
        });

    if ( keepLength > filteredMeta.length ) {
      this.cell.reset( filteredMeta, { silent: true } );
    }
    this.row.remove( this.row.get(cid), { silent: true } );
  },
  setOption: function () {
    return this.option.set.apply(this.option, arguments);
  },
  getOption: function () {
    return this.option.get.apply(this.option, arguments);
  },
  getColID: function ( item, inorder ) {
    if( item === "*" || _(item).isString() ) {
      return item;
    } else if( _(item).isNumber() ) {
      return inorder ? this.colInvertLinker[item] : this.visibleCol[item];
    }
    return null;
  },
  getColIndex: function ( item, inorder ) {
    if( item === "*" || _(item).isNumber() ) {
      return item;
    } else if( _(item).isString() ) {
      return inorder ? this.colLinker[item] : _(this.visibleCol).indexOf(item);
    }
    return null;
  },
  updateVisibleCol: function() {
    var colOrder = this.getOption("colOrder");
    this.visibleCol = _.reduce(colOrder, function(memo, col) {
      if(!this.getMeta(["*", col], "hidden")) {
        memo.push(col);
      }
      return memo;
    }, [], this);
  },
  getVisibleCol: function() {
    return this.visibleCol;
  },
  getFrozenArea: function() {
    return _.reduce(_.range(this.getOption("frozenColumn")), function ( memo, col ) {
      return memo + this.getMeta( ["*", col], "width");
    }, 0, this);
  },
  makeJSONfromArray: function ( arr ) {
    var keys = _.keys(this.colLinker ),
        nested = _.isArray(arr[0]) ? true : false;

    if ( nested ) {
      arr = _.map( arr, function(values) {
        return _.object( keys, values );
      }, this );
    } else {
      arr = _.object( keys, arr );
    }

    return arr;
  },
  checkDataType: function (data) {
    if ( _.isArray(data) ) {
      if ( !type.isObject(data[0]) ) {
        data = this.makeJSONfromArray( data );
      }
    } else if ( type.isObject(data) ) {
    } else {
      throw new TypeError("Array, JSON data types allow only.");
    }
    return data;
  },
  addRow: function ( index, data, options ) {
    var models,
        rowCount = 0;

    options = options || {};

    if ( arguments.length === 0 ) {
      data = {};
      index = null;
    } else if( arguments.length === 1 ) {
      if ( _.isNumber(arguments[0]) ) {
        data = {};
      } else {
        data = this.checkDataType(index);
        index = null;
      }
    } else if( arguments.length >= 2 ) {
      if ( _.isObject(arguments[0]) ) {
        options = data;
        data = index;
        index = null;
      }
      data = this.checkDataType(data);
    }

    if ( index === 0 ) {
      models = this.collection.unshift( data, options );
    } else {
      if ( index ) {
        options.at = index;
      }
      models = this.collection.add( data, options );
    }

    if ( !options.group ) {
      if ( _.isArray( models ) ) {
        _.each( models, function( element ) {
          element.__isNew = true;
          rowCount += 1;
        });
      } else {
        models.__isNew = true;
        rowCount += 1;
      }

      if ( options.save === true ) {
        if ( _.isArray( models ) && models.length === 1 ) {
          this.save( models[0], options );
        } else {
          this.save( models, options );
        }
      }

      if ( !options.silent ) {
        index = _.isNull(index) ? this.getDataLength() - 1 : index;

        if ( options.focus === true ) {
          if ( index >= this.view.rowTop + this.getOption('rowNum') || index < this.view.rowTop ) {
            this.setOption( "scrollTop", index * 20 );
          }
          this.view.setFocusedCell( index, 0 );
        } else if ( this.view.focusedCell ) {
          if ( this.view.focusedCell.rowIndex >= index ) {
            this.view.setFocusedCell( this.view.focusedCell.rowIndex + rowCount, this.view.focusedCell.colIndex );
          }
        }

        this.view.trigger( 'addRow', { type: "addRow" }, { index: index, addedCount: rowCount } );
      }
    }
  },
  removeRow: function ( index, options ) {
    var targetRow,
        removedRow,
        targetIndex = [],
        focusedRow = -1,
        rowCount = 0;

    index = _.isArray(index) ? index : [index];
    if ( index.length === 0 ) {
      return;
    }
    options = options || {};

    targetRow = _.reduce( index, function( memo, item ) {
      if ( _.isString(item) ) {
        item = this.collection.get(item);
      }

      if ( item instanceof Backbone.Model ) {
        item = this.collection.indexOf( item );
      }

      if ( _.isNumber(item) ) {
        targetRow = this.collection.at( item );
        if ( targetRow && ( options.group || !this.getMeta( [item, "*"], "group" ) ) ) {
          this.removeMetaByDataCID( targetRow.cid );
          memo.push( targetRow );
          targetIndex.push(item);
        }
      }

      return memo;
    }, [], this );

    if ( targetRow.length > 0 ) {
      if ( this.view.focusedCell ) {
        focusedRow = this.view.focusedCell.rowIndex;
      }
      if ( options.destroy && targetRow.length === 1 ) {
        options.url = _.result( targetRow[0], 'url' );
      }

      targetRow = this.collection.remove( targetRow, options );

      if ( !options.group ) {
        removedRow = _.reduce( targetRow, function( memo, element ) {
          if ( !element.__isNew ) {
            memo.push(element);
          }
          return memo;
        }, [] );
        Array.prototype.push.apply( this.collection.__removeModels, removedRow );

        if ( options.destroy && targetRow.length === 1 ) {
          this.destroy( targetRow[0], options );
        }

        if ( !options.silent ) {
          if ( focusedRow > -1 ) {
            _.each( targetIndex, function( value ) {
              if ( focusedRow > value ) {
                rowCount += 1;
              } else if ( focusedRow === value && focusedRow >= this.view.getRowLength() ) {
                rowCount += 1;
              }
            }, this );

            if ( rowCount > 0 ) {
              this.view.setFocusedCell( this.view.focusedCell.rowIndex - rowCount, this.view.focusedCell.colIndex );
            }
          }

          this.view.trigger( 'removeRow', { type: "removeRow" }, { index: targetIndex.slice(), removedRow: _( targetRow ).map( function( model ) { return model.toJSON(); } ) } );
        }
      }
    }
  },
  removedRow: function ( options ) {
    if ( options && options.ref ) {
      return this.collection.__removeModels;
    } else {
      return _( this.collection.__removeModels ).map( function( model ) { return model.toJSON(); } );
    }
  },
  sort: function ( columns, directions, options ) {
    var i = 0,
        colSortInfo = this.collection.sortInfo,
        sortInfo = {
          before: {
            columns: _.isFunction( colSortInfo.column ) ? null : colSortInfo.column.slice(),
            directions: colSortInfo.direction.slice()
          },
          after: {
            columns: null,
            directions: null
          }
        };

    options = options || {};

    if ( _.isUndefined(columns) ) {
      colSortInfo.column = [];
    } else if ( _.isFunction(columns) ) {
      colSortInfo.column = columns;
    } else {
      if ( _.isNumber( columns ) || _.isString( columns ) ) {
        columns = [columns];
      }
      columns = _.map( columns, function (item) {
        return this.getColID(item);
      }, this );
      colSortInfo.column = columns;
    }

    if ( _.isUndefined(directions) || _.isNull(directions) ) {
      if ( _.isUndefined(columns) ) {
        colSortInfo.direction = [];
      } else {
        colSortInfo.direction = ['asc'];
      }
    } else {
      if ( _.isString( directions ) ) {
        directions = [directions];
      }
      colSortInfo.direction = directions;
    }

    while ( i < colSortInfo.column.length ) {
      if ( colSortInfo.direction[i] ) {
        colSortInfo.direction[i] = colSortInfo.direction[i].toLowerCase();
      } else {
        colSortInfo.direction[i] = 'asc';
      }
      i += 1;
    }

    sortInfo.after.columns = _.isFunction( colSortInfo.column) ? null : colSortInfo.column.slice();
    sortInfo.after.directions = colSortInfo.direction.slice();

    if ( !options.group && this.groupInfo.grouped ) {
      options.sort = true;
      this.group.call( this, colSortInfo.column.slice(), colSortInfo.direction.slice(), null, options );
    } else {
      this.collection.sortData( options );
    }

    if ( !options.silent ) {
      this.view.trigger( 'sort', { type: "sort" }, sortInfo );
    }
  },
  wrapRoot: function( data, options ) {
    var wrapper;
    if ( options.rootName ) {
      wrapper = {};
      wrapper[options.rootName] = data;
      data = wrapper;
    }
    return data;
  },
  convertJSONtoXML: function( model, options ) {
    var data;

    model = model || {};
    if ( options.data ) {
      data = options.data;
    } else {
      if ( _.isString(model) ) {
        data = JSON.parse(model);
      } else {
        data = model.toJSON();
      }
    }

    if ( options.converter ) {
      data = options.converter.json2xml_str.call( options.converter.json2xml_str, data, options );
    } else if ( this.view.options.xmlConverter ) {
      data = this.wrapRoot( data, options );
      data = this.view.options.xmlConverter.json2xml_str(data);
    }

    return data;
  },
  sendXML: function( model, options ) {
    var that = this;

    options = options || {};
    options.type = options.type || 'POST';
    options.contentType = options.contentType || 'application/xml';
    options.dataType = options.dataType || 'xml';
    options.processData = false;

    if ( this.view.options.xmlConverter ) {
      options.defaultXMLConverter = this.view.options.xmlConverter;
    }

    options.data = this.convertJSONtoXML( model, options );
    options.converters = {
      "text xml": function(value) {
        var targetPath;
        value = $.parseXML(value);

        if ( options.converter ) {
          value = options.converter.xml2json.call( options.converter.xml2json, value, options );
        } else if ( that.view.options.xmlConverter ) {
          value = that.view.options.xmlConverter.xml2json(value);
          if ( options.targetPath ) {
            if ( _.isString(options.targetPath) ) {
              targetPath = options.targetPath.split('.');
              value = _.reduce( targetPath, function( memo, key ) {
                return memo[key];
              }, value );
            } else if ( _.isFunction(options.targetPath) ) {
              value = options.targetPath(value);
            }
          }
        }

        return value;
      }
    };
    return options;
  },
  fetch: function( model, options ) {
    if ( arguments.length > 0 ) {
      if ( type.isNumber( model ) ) {
        model = this.collection.at( model );
      } else if ( !( model instanceof Backbone.Collection || model instanceof Backbone.Model ) ) {
        options = model;
        model = this.collection;
      }

      if ( options && options.contentType && options.contentType.indexOf('xml') > -1 ) {
        options = this.sendXML( model, options );
      }
    } else {
      model = this.collection;
    }

    model.fetch( options );
  },
  save: function ( model, options ) {
    var idx,
        data,
        success = options.success;

    options = options || {};
    if ( !_.isArray (model) ) {
      idx = this.collection.indexOf(model);
      if ( options.formatted || options.pick || options.omit ) {
        data = this.getData( [idx, '*'], options );
        options.patch = true;
      } else {
        data = null;
      }

      options.success = function ( modelCompleted, resp ) {
        model.__isNew = false;
        if ( success ) {
          success( modelCompleted, resp, options );
        }
      };

      if ( options.contentType && options.contentType.indexOf('xml') > -1 ) {
        if ( options.patch ) {
          options.data = data;
        }
        options = this.sendXML( model, options );
      }

      this.collection.at( idx ).save( data, options );
    }
  },
  destroy: function ( model, options ) {
    var vModel = this,
        success = options.success;

    if ( !_.isArray ( model ) ) {
      if ( options.contentType && options.contentType.indexOf('xml') > -1 ) {
        options = this.sendXML( model, options );
      }

      options.success = function ( modelCompleted, resp ) {
        _.each( vModel.collection.__removeModels, function ( element, index, list ) {
          if ( modelCompleted.id === element.id ) {
            list.splice( index, 1 );
          }
        });

        if ( success ) {
          success( modelCompleted, resp, options );
        }
      };

      model.destroy( options );
    }
  },
  getCUData: function ( options ) {
    options = options || {};

    var models = { createList: [], updateList: [], deleteList: [] },
        excludeCreate = options.excludeCreate || false,
        excludeUpdate = options.excludeUpdate || false,
        excludeDelete = options.excludeDelete || false;

    if ( !excludeCreate || !excludeUpdate ) {
      models = _.reduce( this.collection.models, function ( store, model ) {
        if ( !excludeCreate && model.__isNew ) {
          store.createList.push( options.ref ? model : model.toJSON() );
        } else if ( !excludeUpdate && model.hasChanged() ) {
          store.updateList.push( options.ref ? model : model.toJSON() );
        }
        return store;
      }, models, this );
    }
    if ( !excludeDelete ) {
      Array.prototype.push.apply( models.deleteList, this.removedRow( options ) );
    }

    return models;
  },
  syncData: function ( options ) {
    var data,
        vModel = this,
        dataCreated,
        success,
        dummy = _.extend( {}, Backbone.Events, {
                  url: this.collection.compoundURL
                } );

    options = options || {};
    success = options.success;

    if ( options.modified === true ) {
      options.ref = true;

      data = this.getCUData( options );
      dataCreated = data.createList.slice();
      dummy = _.extend( dummy, {
        getJSON: function (target) {
          _.each( target, function( model, idx, list ) {
            list[idx] = vModel.getData( [ model.collection.indexOf(model), '*' ], options );
          }, vModel );
        },
        toJSON: function () {
          if ( options.formatted || options.pick || options.omit ) {
            this.getJSON( data.createList );
            this.getJSON( data.updateList );
          }
          return data;
        }
      } );
    } else {
      dummy = _.extend( dummy, {
        toJSON: function () {
          if ( options.checked || options.formatted || options.pick || options.omit ) {
            data = vModel.getData( ['*', '*'], options );
          } else {
            data = vModel.collection.toJSON();
          }
          return data;
        }
      } );
    }

    if ( options && options.contentType && options.contentType.indexOf('xml') > -1 ) {
      options = this.sendXML( JSON.stringify( dummy.toJSON() ), options );
    }

    options.success = function ( model, resp ) {
      if ( !(options.excludeDelete || false) ) {
        vModel.collection.__removeModels = [];
      }

      _.each( dataCreated, function ( item, idx ) {
        item.__isNew = false;
        if ( options.afterProcess && model.createList && model.createList[idx] ) {
          item.set( model.createList[idx] );
        }
      });

      if ( success ) {
        success( model, resp, options );
      }
    };

    return Backbone.sync( "create", dummy, options );
  },
  getGridData: function () {
    return this.collection;
  },
  setDefaults: function ( defaults ) {
    this.collection.defaults = defaults;
  },
  getDefaults: function () {
    var defaults = null;
    if ( type.isFunction( this.collection.defaults ) ) {
      defaults = this.collection.defaults();
    } else if ( type.isObject( this.collection.defaults ) ) {
      defaults = _.clone( this.collection.defaults );
    }
    return defaults;
  }
});

var w5DataModelProto = {
  parse: function(data, options) {
    if ( options.saved ) {
      data = this.attributes;
    } else {
      if( _.isString(data) ) {
        data = JSON.parse(data);
      }
      if( this.collection && _.isArray(data) ) {
        return this.parseWithDataType( this.collection.keys, data, ( this.collection.grid ? this.collection.grid.options.colModel : null )  );
      }
    }
    return data;
  },
  defaults: function () {
    if ( this.collection && this.collection.defaults ) {
      if ( type.isFunction( this.collection.defaults ) ) {
        return this.collection.defaults.call(this);
      }
      return this.collection.defaults;
    }
  },
  parseWithDataType: function( keys, data, colModel ) {
    var dataType,
        result = {};

    for ( var i = 0, length = keys.length; i < length; i++ ) {
      if ( colModel ) {
        dataType = colModel[i].dataType;
        if ( dataType ) {
          data[i] = w5.dataType[dataType]( data[i] );
        }
      }
      result[keys[i]] = data[i];
    }
    return result;
  }
};

var w5DataCollectionProto = {
  __validator: null,
  __invalidCallback: null,
  __sorting: false,
  __filtering: false,
  __originalCollection: null,
  defaults: null,
  initialize: function(models, options) {
    if(options) {
      this.grid = options.grid;
      this.keys = options.keys;
      this.url = options.url;
      this.compoundURL = options.compoundURL;
      this.defaults = options.defaults;
      this.__removeModels = [];
    }
  },
  clone: function() {
    return new this.constructor(this.models, {grid: this.grid, keys: this.keys});
  },
  parse: function ( data ) {
    if( _.isString(data) ) {
      return JSON.parse(data);
    }
    return data;
  },
  cloneCollection: function () {
    if ( !this.__originalCollection ) {
      this.__originalCollection = this.clone();
      this.__originalCollection.listenTo( this, 'add remove', this.syncData );
    }
  },
  resetCollection: function (action) {
    if ( action === 'filter' ) {
      if ( this.__sorting ) {
        this.reset( this.__originalCollection.models, { silent: true } );
        this.sortData();
      } else {
        this.reset( this.__originalCollection.models );
        this.__originalCollection.stopListening( this, 'add remove', this.syncData );
        this.__originalCollection = null;
      }
    } else if ( action === 'sort' ) {
      if ( this.__filtering ) {
        this.reset( this.__originalCollection.models, { silent: true } );
        this.filterData( true, {} );
      } else {
        this.reset( this.__originalCollection.models );
        this.__originalCollection.stopListening( this, 'add remove', this.syncData );
        this.__originalCollection = null;
      }
    }
  },
  syncData: function ( model, collection, options ) {
    var idx;

    if( options.add ) {
      if( options.at === 0 ) {
        idx = this.indexOf( collection.at(1) );
      } else {
        idx = collection.indexOf(model) - 1;
        idx = this.indexOf( collection.at(idx) ) + 1;
      }
      this.add( model, _.extend( options, {at: idx, silent: true } ) );
    } else {
      idx = this.indexOf(model);
      this.remove( model, _.extend( options, { index: idx, silent: true } ) );
    }
  },
  sortInfo: {
    column: [],
    direction: [],
    comparator: function ( item1, item2 ) {
      if ( !this.sortInfo.column ) {
        return 0;
      }

      var cols = this.sortInfo.column,
          dirs = this.sortInfo.direction,
          col;

      col = _.find( cols, function ( attr ) {
        return item1.attributes[attr] !== item2.attributes[attr];
      });

      if ( !col ) {
        var compCollection = item1.collection.__originalCollection || item1.collection,
            idx1 = compCollection.indexOf(item1),
            idx2 = compCollection.indexOf(item2);
        return idx1 > idx2 ? 1 : -1;
      }

      if ( dirs[_.indexOf( cols, col )]  === 'asc' ) {
        return _.isUndefined(item2.attributes[col]) ? 1 : item1.attributes[col] > item2.attributes[col] ? 1 : -1;
      } else {
        return _.isUndefined(item1.attributes[col]) ? 1 : item1.attributes[col] < item2.attributes[col] ? 1 : -1;
      }
    }
  },
  sortData: function( options ) {
    if ( this.sortInfo.column.length > 0 ) {
      this.cloneCollection();
      this.__sorting = true;

      if ( _.isFunction(this.sortInfo.column) ) {
        this.comparator = this.sortInfo.column;
      } else {
        this.comparator = this.sortInfo.comparator;
      }

      this.sort( options );
    } else {
      if ( this.__sorting ) {
        this.__sorting = false;
        this.comparator = null;
        this.resetCollection('sort');
      }
    }
  }
};

var w5DataModelProtoPro = null,
    w5DataCollectionProtoPro = null;
