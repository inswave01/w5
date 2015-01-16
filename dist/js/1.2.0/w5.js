/*!
 * w5 1.2.0
 * [https://w5.io]
 *
 * Copyright 2013 Inswave Foundation and other contributors
 * Released under the LGPLv3.0 license
 *
 * Date: 2015-01-16
 */

(function(root, factory) {
  /* global define */
  if ( typeof define === 'function' && define.amd ) {
    define( ['jquery', 'underscore', 'Backbone', 'exports'], function( $, _, Backbone, exports ) {
      root.w5 = factory( $, _, Backbone, root, exports );
    });
  } else {
    root.w5 = factory( (root.jQuery || root.$), root._, root.Backbone, root, {} );
  }

}( this, function( $, _, Backbone, window, w5 ) {

    "use strict";

var
  resizeChecker = (function() {
    var gridArr = [];

    setInterval(function() {
      _(gridArr).each( function(grid) {
        grid.checkResize();
      });
    }, 200);

    return {
      add: function(grid) {
        grid.wrapper_width = grid.$el.width();
        gridArr.push(grid);
      }
    };
  })(),
  type = function (o) {

    if ( o === null ) {
      return 'null';
    }

    if ( o && ( o.nodeType === 1 || o.nodeType === 9 ) ) {
      return 'element';
    }

    var s = Object.prototype.toString.call(o);
    var type = s.match(/\[object (.*?)\]/)[1].toLowerCase();

    if ( type === 'number' ) {
      if ( isNaN(o) ) {
        return 'nan';
      }
      if ( !isFinite(o) ) {
        return 'infinity';
      }
    }
    return type;
  };
  _.each( ['Null',
          'Undefined',
          'Object',
          'Array',
          'String',
          'Number',
          'Boolean',
          'Function',
          'RegExp',
          'Element',
          'NaN',
          'Infinite'],
    function (t) {
      type['is' + t] = function (o) {
        return type(o) === t.toLowerCase();
      };
    }
  );

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

var eventSplitter = /\s+/,
    selectorPattern = [/^[^\[\s]+\[[^\]]+\]|^[^\[\s]+/g, /(^[^\[\]:]*)(\[[^\]]+\])?(?::(\w+$))?/g],
    BView = Backbone.View.prototype;

var GridProto = {
  template: _.template(
    "<<%= tagName %> id='<%= id %>' class='gGrid<%= className %>' style='width:<%= width %>;" + "<%= style %>'>" +
      "<div class='gGrid-setTable'>" +
        "<div class='w5_grid_editbox' contenteditable='true'></div>" +
        "<table class='gGrid-table' style='width:0'>" +
          "<caption class='gGrid-caption'><%= caption %></caption>" +
          "<colgroup></colgroup>" +
          "<thead></thead>" +
          "<tbody></tbody>" +
        "</table>" +
        "<div class='w5-grid-select-area hide'></div>" +
        "<div class='w5-grid-focused-cell border-top hide'></div>" +
        "<div class='w5-grid-focused-cell border-right hide'></div>" +
        "<div class='w5-grid-focused-cell border-bottom hide'>" +
        //  "<button type='button' class='w5-grid-select-dragger'>Drag and Select area</button>" +
        "</div>" +
        "<div class='w5-grid-focused-cell border-left hide'></div>" +
        "<div class='adjustCol-handle-hover hide'></div>" +
        "<div class='frozenHandle hide'></div>" +
        "<div class='frozenHandle-move hide'></div>" +
        "<div class='columnMove-start hide'></div>" +
        "<div class='columnMove-move hide'></div>" +
        "<div class='columnMove-indicator hide'>" +
          "<span class='columnMove-indicator-arrow'></span>"+
          "<span class='columnMove-indicator-bar'></span>"+
        "</div>" +
        "<div class='adjustCol-start hide'>" +
          "<span class='adjustCol-start-icon'></span>" +
        "</div>" +
        "<div class='adjustCol-move hide'>" +
          "<span class='adjustCol-move-icon'></span>" +
        "</div>" +
        "<div class='gScroll-v'>" +
          "<button class='scrollHandler'>Move vertical scroll</button>" +
        "</div>" +
        "<div class='gScroll-h'>" +
          "<button class='scrollHandler'>Move horizontal scroll</button>" +
        "</div>" +
      "</div>" +
    "</<%= tagName %>>"
  ),
  events: {
    "dblclick .gGrid-table>thead" : function(e) { this.sortColumn.dblClickEvent.call( this, e ); },
    "mousedown .gGrid-table>thead" : function(e){ this.columnMove.downEvent.call( this, e ); },
    "click .gGrid-table>tbody" : function(e){ this.clickCell.clickEvent.call( this, e ); },
    "dblclick .gGrid-table>tbody" : function(e){ this.clickCell.clickEvent.call( this, e ); },
    "mousedown .frozenHandle" : function(e){ this.frozenColumn.downEvent.call( this, e ); },
    "mousedown .gScroll-v" : function(e) { this.verticalScroll.areaDownEvent.call( this, e ); },
    "mousedown .gScroll-v .scrollHandler" : function(e) { this.verticalScroll.handleDownEvent.call( this, e ); },
    "touchstart .gScroll-v .scrollHandler" : function(e) { this.verticalScroll.handleDownEvent.call( this, e ); },
    "mousedown .gScroll-h" : function(e) { this.horizontalScroll.areaDownEvent.call( this, e ); },
    "mousedown .gScroll-h .scrollHandler" : function(e) { this.horizontalScroll.handleDownEvent.call( this, e ); },
    "touchstart .gScroll-h .scrollHandler" : function(e) { this.horizontalScroll.handleDownEvent.call( this, e ); },
    "mousewheel" : function(e) { this.scrollByWheel.wheelEvent.call( this, e ); },
    "keydown .w5_grid_editbox": "handleKeydown",
    "keydown .gGrid-table>tbody": "handleKeydown"
  },
  keydownEvents: {
    38:  "moveUp",              // up
    40:  "moveDown",            // down
    37:  "moveLeft",            // left
    39:  "moveRight",           // right
    13:  "focusWidget",         // enter
    113: "focusWidget",         // F2
    27:  "blurWidget",          // esc
    9:   "moveActionableItem",  // Tab
    36:  "jumpTo",              // HOME
    35:  "jumpTo",              // END
    33:  "jumpTo",              // PAGE UP
    34:  "jumpTo"               // PAGE DOWN
  },
  keySet: {
    UP : 38,
    DOWN : 40,
    LEFT : 37,
    RIGHT : 39,
    ENTER : 13,
    F2 : 113,
    ESC : 27,
    TAB : 9,
    HOME : 36,
    END : 35,
    PageUP : 33,
    PageDOWN : 34
  },
  initialize: function(options) {
    this.options = options;
    if(options.parseTable) {
      this.parseTable(options);
      if(!this.collection && options.collection) {
        this.collection = options.collection;
      }
    }
    var keys = _.map(options.colModel, function(model) {
          if( !("headerLabel" in model) ) {
            model.headerLabel = model.id;
          }
          return model.id || model.headerLabel;
        }),
        defaults = options.defaults || _.object( keys, _.pluck(options.colModel, "default") ),
        that = this;

    if( !this.id && this.$el && this.$el.attr("id") ) {
      this.id = this.$el.attr("id");
    }

    if ( _.isBoolean( options.emulateHTTP ) ) {
      Backbone.emulateHTTP = options.emulateHTTP;
    }

    if( options.collection instanceof Backbone.Collection ) {
      _.extend( this.collection.constructor.prototype.model.prototype, w5DataModelProto, w5DataModelProtoPro );
      _.extend( this.collection.constructor.prototype, w5DataCollectionProto, w5DataCollectionProtoPro );

      w5DataCollectionProto.initialize.call( this.collection, null, {
        grid: that,
        keys: options.collection.keys ? options.collection.keys : keys,
        url: options.collection.url,
        compoundURL: options.collection.compoundURL,
        defaults: options.collection.defaults ? options.collection.defaults : defaults
      });
    } else {
      this.collection = new Collection( options.collection, {
        grid: this,
        keys: keys,
        defaults: defaults,
        parse: true
      });    
    }

    this.viewModel = new ViewModel(options.option, options.colModel, this, this.collection, options.style);

    if ( options.validator ) {
      this.setValidator( options.validator );
    }
    if ( _.isFunction(options.invalidCallback) ) {
      this.setInValidCallback(options.invalidCallback);
    }
    if ( options.fetch ) {
      this.viewModel.fetch( this.collection, _.extend( { reset: true }, options.fetch ) );
    }

    this.isBasic = _.isUndefined( this.collection.filterInfo );
    this.isMobile = this.detectMobile.any();

    this.tabbableElements = ['checkbox'];

    this.listenTo( this.collection, 'change', this.onModelChange );
    this.listenTo( this.collection, 'add remove', this.onModelAddRemove );
    this.listenTo( this.collection, 'reset sort', this.onReset );
    this.listenTo( this.collection, 'sync', this.drawWhole );
    this.listenTo( this.viewModel.table, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.column, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.row, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.cell, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.option, 'change', this.onOptionChange );
    
    this.setGridEvents();
  },
  render: function() {
    var $el,
        $wrapper_div;

    this.viewModel.updateVisibleCol();

    $el = $(this.template({
      tagName: this.tagName || "div",
      id: this.id,
      className: this.className ? ( " " + this.className ) : "" ,
      style: this.$el[0].style.cssText ? ( " " + this.$el[0].style.cssText ) : "",
      width: this.viewModel.getOption("width"),
      caption : this.viewModel.getOption("caption")
    }));

    this.$el.replaceWith( $el );
    this.$el = $el;
    $wrapper_div = this.$(".gGrid-setTable");
    this.$wrapper_div = $wrapper_div;

    this.tableWidth = $wrapper_div.width();
    this.wholeTblWidth = this.getWholeTblWidth();

    // scroll value
    this.rowTop = 0;
    this.rowNum = this.$("tbody tr").length;
    this.startCol = 0;
    this.endCol = this.$("colgroup col").length;

    this.$scrollYArea   = this.$(".gScroll-v");
    this.$scrollYHandle = this.$(".gScroll-v .scrollHandler");
    this.$scrollXArea   = this.$(".gScroll-h");
    this.$scrollXHandle = this.$(".gScroll-h .scrollHandler");
    this.$editBox       = this.$(".w5_grid_editbox");

    this.scrollYHandleMinHeight = parseInt( this.$scrollYHandle.css('min-height'), 10 );
    this.scrollXHandleMinWidth  = parseInt( this.$scrollXHandle.css('min-width'), 10 );

    this.addEvents();
    this.setResize();

    this.headNum = this.$("thead tr").length;

    this.trigger( 'render', { type: "render" } );

    return this; // enable chained calls
  },
  detectMobile: {
    userAgent: navigator.userAgent,
    android: function() {
      return (/Android/i).test(this.userAgent);
    },
    blackBerry: function() {
      return (/BlackBerry/i).test(this.userAgent);
    },
    iOS: function() {
      return (/iPhone|iPad|iPod/i).test(this.userAgent);
    },
    opera: function() {
      return (/Opera Mini/i).test(this.userAgent);
    },
    windows: function() {
      return (/IEMobile/i).test(this.userAgent);
    },
    any: function() {
      return ( this.iOS() || this.android() || this.blackBerry() || this.opera() || this.windows() );
    }
  },
  setGridEvents: function() {
    var events = {},
        i;

    for ( i in this.options.gridEvents ) {
      var eventKey = i.split(eventSplitter);
      if ( !events[eventKey[0]] ) {
        events[eventKey[0]] = [];
      }
      events[eventKey[0]].push({
        select: eventKey.splice(1).join(' '),
        funcName: this.options.gridEvents[i]
      });
    }
    this.gridEventMatch = events;
    for ( i in events ) {
      if ( i === "change" ) {
        continue;
      }
      this.events[i + " td"] = "handleCommonEvent";
    }
    this.delegateEvents(this.events);
  },
  handleCommonEvent: function(e) {
    var events = this.gridEventMatch[e.type] || [],
        $td, col, row, cid, frozenColumn,
        result = {};

    if ( events.length > 0 ) {
      $td = $(e.target).closest("td");
      col = $td.index();
      row = $td.parent().index() + this.rowTop;
      cid = this.viewModel.getDataCID(row);
      frozenColumn = this.viewModel.getOption("frozenColumn");

      if ( col >= frozenColumn ) {
        col += this.startCol - frozenColumn;
      }

      col = this.viewModel.getColID( col, true );

      result.rowIndex = row;
      result.colID = col;

      this.fireGridEvent( events, cid, col, e, result, false );
    }
  },
  fireGridEvent: function( events, cid, colID, eventObj, options, checkedPseudo ) {
    var i, j, elems;

    for ( i = 0; i < events.length; i++ ) {
      elems = this.select( events[i].select );
      for ( j = 0; j < elems.length; j++ ) {
        if ( this.viewModel.getDataCID( elems[j][0] ) === cid && elems[j][1] === colID ) {
          if ( checkedPseudo || !( eventObj.target.tagName === 'TD' && elems[j].pseudo && elems[j].pseudo === 'items' ) ) {
            if ( _.isString( events[i].funcName ) ) {
              this.options[events[i].funcName].call( this, eventObj, options );
            } else if ( _.isFunction( events[i].funcName ) ) {
              events[i].funcName.call( this, eventObj, options );
            }
          }
        }
      }
    }
  },
  parseTable: function(options) {
    if ( this.$el[0].tagName !== "TABLE" ) {
      return;
    }

    var $trs = this.$("tr"),
        $headTr = $($trs[0]),
        colWidth = [],
        headerLabel = [],
        data, keys;

    $trs = $(_($trs).rest());

    _($headTr.find("td")).each(function (td) {
      var $tdEle = $(td),
          colSpan = parseInt($tdEle.attr("colspan"), 10) || 1,
          i;
      colWidth.push( $tdEle.width() );
      headerLabel.push( $tdEle.text() );
      for ( i = 1; i < colSpan; i++ ) {
        colWidth.push(0);
        headerLabel.push("");
      }
    });
    options.colModel = _(headerLabel).map(function(label, index) {
      return {
        headerLabel: label,
        width: colWidth[index]
      };
    });
    keys = _.map(options.colModel, function(model) {
      return model.id || model.headerLabel;
    });

    data = _($trs).map(function (tr) {
      return _($(tr).find("td")).map(function (td) {
        return $(td).text();
      });
    });
    options.collection = new Collection(data, {keys:keys, parse:true});

    options.style = [];
    _($trs).each(function (tr, row) {
      _($(tr).find("td")).each(function (td, col) {
        var styleStr = $(td).attr("style") || "",
            styleObj = _(styleStr.split(/;+\s*/g)).reduce( function( memo, item ) {
              var entry = item.split(/:/);
              if(entry.length === 2) {
                if(!memo) {
                  memo = {};
                }
                memo[entry[0]] = entry[1];
              }
              return memo;
            }, null);
        if (styleObj) {
          options.style.push([
            options.collection.at(row).cid,
            headerLabel[col],
            styleObj
          ]);
        }
      });
    });
  },
  createTbody: function () {
    var $tbody = this.$("tbody"),
        $colgroup = this.$("colgroup"),
        rowNum = this.viewModel.getOption("rowNum"),
        visibleCol = this.viewModel.getVisibleCol(),
        widthSum = 0,
        colgroup = "",
        i, j, $tr, colNum;

    this.$("col").remove();
    this.$("tr").remove();

    for( colNum = 0; colNum < visibleCol.length; colNum++ ) {
      widthSum += this.viewModel.getMeta( ["*", colNum], "width" );
      colgroup += "<col style='width:" + this.viewModel.getMeta( ["*", colNum], "width" ) + "px'>";
      if( widthSum >= this.tableWidth ) {
        colNum++;
        break;
      }
    }

    rowNum = Math.min( rowNum, this.collection.length );
    for(i = 0; i < rowNum; i++) {
      $tr = $("<tr class='gGrid-row'>");
      for(j = 0; j < colNum; j++) {
        $tr.append("<td>");
      }
      $tbody.append($tr);
    }
    $colgroup.append(colgroup);

    $tr = $("<tr>");
    _(_.range( colNum )).each(function () {
      var $th = $("<th class='gGrid-headerLabel' scope='col'><div class='gGrid-headerLabelWrap'></th>");
      $tr.append($th);
    }, this);

    this.$wrapper_div.find("thead").append($tr);
  },
  addEvents: function() {
    var _this = this;
    this.$editBox.on("blur", function(e) {
      cellObjects["text"].endEdit.call( cellObjects["text"], e, _this );
    });
    this.delegateEvents();

    resizeChecker.add(this);
  },
  sortColumn: {
    dblClickEvent : function(e) {
      var $th = $(e.target).closest("th"),
          tdCol = $th.index(),
          frozenColumn = this.viewModel.getOption("frozenColumn"),
          col = tdCol < frozenColumn ? tdCol : tdCol + this.startCol - frozenColumn;
      if ( this.viewModel.getMeta( ["*", col], "sortable") !== false ) {
        this.sortColumn.sortColumn.call( this, col );
      }
      $("document").addClass("noselect");
    },
    sortColumn : function( col ) {
      var column = _.isFunction( this.collection.sortInfo.column ) ? [] : this.collection.sortInfo.column.slice() || [],
          direction = this.collection.sortInfo.direction.slice() || [],
          colID = this.viewModel.getColID(col),
          index = _.indexOf( column, colID ),
          sortState = index === -1 ? 0 : ( ( direction[index] || 'asc' ) === "asc" ? 1 : 2 );

      sortState = ( sortState + 1 ) % 3;

      if ( sortState === 0 ) { 
        column.splice(index, 1);
        direction.splice(index, 1);
      } else {
        if ( index === -1 ) {
          column.push(colID);
          direction.push(sortState === 1 ? "asc" : "desc");
        } else {
          direction[index] = sortState === 1 ? "asc" : "desc";
        }
      }
      this.sort(column, direction);
    }
  },
  columnMove : {
    draggedColumn   : null,
    _wrapMoveEvent  : null,
    _wrapUpEvent    : null,
    $pickTH         : null,
    dragInfo        : {
                        startX : null,
                        indicatorMovePosX : null,
                        increasedX : null
                      },

    _downEvent : function(e) {
      var colOrder = this.viewModel.getOption("colOrder"),
          visibleCol = this.viewModel.getVisibleCol(),
          thIndex, frozenColumn;

      this.columnMove.$indicator =  this.$(".columnMove-indicator");
      this.columnMove.$indicatorStart = this.$(".columnMove-start");
      this.columnMove.$indicatorMove = this.$(".columnMove-move");
      this.columnMove.$pickTH = $(e.target).closest("th");
      this.columnMove.dragInfo.startX = e.clientX; 
      this.columnMove.dragInfo.indicatorMovePosX = this.columnMove.$pickTH.position().left;

      if ( this.columnMove.$pickTH.length > 0 ) {
        thIndex = this.columnMove.$pickTH.index();
        frozenColumn = this.viewModel.getOption("frozenColumn");
        this.columnMove.draggedColumn = thIndex < frozenColumn ? thIndex : thIndex + this.startCol - frozenColumn;
      }

      if ( colOrder[this.columnMove.draggedColumn] !== visibleCol[this.columnMove.draggedColumn] ) {
        this.columnMove.draggedColumn = _(colOrder).indexOf(visibleCol[this.columnMove.draggedColumn]);
      }

      $("body").addClass("noselect");
    },
    downEvent : function(e) {
      var that;

      if ( e.target.tagName !== 'BUTTON' && ( e.target.className.indexOf('gGrid-headerLabelText') > -1 || e.target.className.indexOf('gGrid-headerLabelWrap') > -1 || e.target.className.indexOf('w5-grid-sort') > -1 ) ) {
        this.columnMove._downEvent.call( this, e);

        that = this;
        this.columnMove._wrapMoveEvent = function(e) { that.columnMove.moveEvent.call( this, e ); };
        this.columnMove._wrapUpEvent = function(e) { that.columnMove.upEvent.call( this, e ); };

        this.columnMove._wrapMoveEvent = _.bind(this.columnMove._wrapMoveEvent, this);
        this.columnMove._wrapUpEvent = _.bind(this.columnMove._wrapUpEvent, this);

        document.body.addEventListener('mousemove', this.columnMove._wrapMoveEvent, true);
        document.body.addEventListener('mouseup', this.columnMove._wrapUpEvent, true);
      }
    },
    _moveEvent : function(e) {
      var $th = $(e.target).closest("th"),
          colOrder = this.viewModel.getOption("colOrder"),
          visibleCol = this.viewModel.getVisibleCol(),
          thIndex, frozenColumn, targetIndex;

      this.columnMove.dragInfo.increasedX = e.clientX - this.columnMove.dragInfo.startX;
      this.columnMove.$indicatorStart.css({
          left : this.columnMove.dragInfo.indicatorMovePosX,
          width : this.columnMove.$pickTH.width() - 2
      }).removeClass("hide");

      this.columnMove.$indicatorMove.css({
        left  : this.columnMove.dragInfo.indicatorMovePosX + this.columnMove.dragInfo.increasedX,
        width : this.columnMove.$pickTH.width()
      }).removeClass("hide");

      if ( $th.length > 0 ) {
        thIndex = $th.index();
        frozenColumn = this.viewModel.getOption("frozenColumn");
        targetIndex = thIndex < frozenColumn ? thIndex : thIndex + this.startCol - frozenColumn;

        if ( colOrder[targetIndex] !== visibleCol[targetIndex] ) {
          targetIndex = _(colOrder).indexOf(visibleCol[targetIndex]);
        }
        if ( targetIndex === this.columnMove.draggedColumn ) {
          this.columnMove.$indicator.addClass("hide");
          $("body").addClass("not-allowed");
          if ( ( e.target.className.indexOf('gGrid-headerLabelWrap') > -1 || e.target.className.indexOf('gGrid-headerLabelText') > -1 || e.target.className.indexOf('w5-grid-sort') > -1 ) ){
            $(e.target).closest("th").addClass("not-allowed").removeClass("allowed");
          }
        } else {  
          this.columnMove.$indicator.removeClass("hide").css({
            left : $th.position().left + (targetIndex < this.columnMove.draggedColumn ? 0 : $th.outerWidth()) -3
          });
          if ( ( e.target.className.indexOf('gGrid-headerLabelWrap') > -1 || e.target.className.indexOf('gGrid-headerLabelText') > -1 || e.target.className.indexOf('w5-grid-sort') > -1 ) ){
            $(e.target).closest("th").addClass("allowed").removeClass("not-allowed");
          }
        }
      }
    },
    moveEvent : function(e) {
      if ( this.columnMove.draggedColumn > -1 ) {
        this.columnMove._moveEvent.call( this, e );
      }
    },
    _upEvent : function(el) {
      var $th = $(el).closest("th"),
          colOrder = this.viewModel.getOption("colOrder"),
          visibleCol = this.viewModel.getVisibleCol(),
          thIndex, frozenColumn, targetIndex;

      if ( $th.length > 0 ) {
        thIndex = $th.index();
        frozenColumn = this.viewModel.getOption("frozenColumn");
        targetIndex = thIndex < frozenColumn ? thIndex : thIndex + this.startCol - frozenColumn;

        if ( colOrder[targetIndex] !== visibleCol[targetIndex] ) {
          targetIndex = _(colOrder).indexOf(visibleCol[targetIndex]);
        }

        if ( this.columnMove.draggedColumn !== targetIndex ) {
          this.moveColumn(this.columnMove.draggedColumn, targetIndex);
        }
      }

      $("body").removeClass("noselect").removeClass("not-allowed");
      $th.removeClass("allowed").removeClass("not-allowed");
      this.columnMove.$indicator.addClass("hide").removeClass("show");
      this.columnMove.$indicatorStart.addClass("hide");
      this.columnMove.$indicatorMove.addClass("hide");
      this.columnMove.draggedColumn = null;
    },
    upEvent : function(e) {
      this.columnMove._upEvent.call( this, e.target );
      document.body.removeEventListener('mousemove', this.columnMove._wrapMoveEvent, true);
      document.body.removeEventListener('mouseup', this.columnMove._wrapUpEvent, true);
    }
  },
  frozenColumn : {
    frozenColumnIdx : null,
    newFrozenCol : -1,
    dragInfo : {},
    _wrapMoveEvent: null,
    _wrapUpEvent: null,

    _downEvent : function(clientX) {
      this.frozenColumn.frozenColumnIdx = this.viewModel.getOption("frozenColumn");

      this.frozenColumn.dragInfo = {
        startX : clientX - this.$wrapper_div.offset().left,
        endX : 0
      };
    },
    downEvent : function(e) {
      var that = this;
      this.frozenColumn._downEvent.call( this, e.clientX );

      this.frozenColumn.$frozenHandle = this.$(".frozenHandle");
      this.frozenColumn.$seperateCol = this.$(".frozenHandle-move");
      this.frozenColumn.$indicator = this.$(".columnMove-indicator");

      this.frozenColumn._wrapMoveEvent = function(e){ that.frozenColumn.moveEvent.call( this, e ); };
      this.frozenColumn._wrapUpEvent = function(e){ that.frozenColumn.upEvent.call( this, e ); };

      this.frozenColumn._wrapMoveEvent = _.bind(this.frozenColumn._wrapMoveEvent, this);
      this.frozenColumn._wrapUpEvent = _.bind(this.frozenColumn._wrapUpEvent, this);

      document.body.addEventListener('mousemove', this.frozenColumn._wrapMoveEvent, true);
      document.body.addEventListener('mouseup', this.frozenColumn._wrapUpEvent, true);
    },
    _moveEvent : function(clientX) {
      var i,
          endCol = -1,
          colWidth = 0,
          widthSum = 0,
          visibleCol = this.viewModel.getVisibleCol(),
          $indicator_width = this.frozenColumn.$indicator.width();

      this.frozenColumn.dragInfo.endX = clientX - this.$wrapper_div.offset().left;
      this.frozenColumn.$seperateCol.css("left", this.frozenColumn.dragInfo.endX);
      this.frozenColumn.$seperateCol.removeClass("hide").addClass("show");

      this.frozenColumn.newFrozenCol = -1;
      for ( i = 0; i < visibleCol.length; i++ ) {
        colWidth = this.viewModel.getMeta( ["*", i], "width" );
        widthSum += colWidth;

        if ( this.frozenColumn.newFrozenCol === -1 ) {
          if ( widthSum - colWidth / 2 >= this.frozenColumn.dragInfo.endX ) {
            this.frozenColumn.newFrozenCol = endCol = i;
            widthSum = colWidth;
          }
        } else {
          endCol = i; 
          if ( widthSum > this.$wrapper_div.width() ) {
            break;
          }
        }
      }

      if ( this.frozenColumn.frozenColumnIdx !== this.frozenColumn.newFrozenCol ) {
        widthSum = 0;
        
        for ( i = 0; i<this.frozenColumn.newFrozenCol; i++ ) {
          widthSum += this.viewModel.getMeta( ["*", i], "width" );
        }        
      }

      this.frozenColumn.$indicator.removeClass("hide").addClass("show").css("left", widthSum-$indicator_width/2);
    },
    moveEvent : function(e) {
      this.frozenColumn._moveEvent.call( this, e.clientX );
    },
    _upEvent : function() {
      this.viewModel.setOption("frozenColumn", this.frozenColumn.newFrozenCol);
      this.frozenColumn.$seperateCol.removeClass("show").addClass("hide");
      this.frozenColumn.$indicator.removeClass("show").addClass("hide");
    },
    upEvent : function(e) {
      this.frozenColumn._upEvent.call( this, e.target );

      document.body.removeEventListener('mousemove', this.frozenColumn._wrapMoveEvent, true);
      document.body.removeEventListener('mouseup', this.frozenColumn._wrapUpEvent, true);
    }
  },
  verticalScroll : {
    pos : null,
    _wrapMoveEvent: null,
    _wrapUpEvent: null,

    _areaDownEvent : function(offsetY){
      var rowTop = this.rowTop,
          vScrollDegree = this.viewModel.getOption("vScrollDegree") || this.viewModel.getOption("rowNum"),
          scrollTop;

      rowTop += (offsetY < this.$scrollYHandle.position().top ? -1 : 1) * vScrollDegree;
      scrollTop = rowTop * 20;
      this.viewModel.setOption("scrollTop", scrollTop);
      $("body").addClass("noselect");
    },
    areaDownEvent : function(e){
      var y = e.offsetY || (e.pageY - this.$scrollYArea.offset().top);
      this.verticalScroll._areaDownEvent.call( this, y );
    },
    _handleDownEvent : function( clientY ){
      var target_top = this.$scrollYHandle.position().top;
      this.verticalScroll.pos = {
        top : target_top,
        currentY : clientY
      };
    },
    handleDownEvent : function(e) {
      var that = this;

      e.preventDefault();
      e.stopPropagation();

      if ( this.isMobile ) {
        if ( e.originalEvent.touches ) {
          e = e.originalEvent.touches[0];
        } else {
          return false;
        }
      }

      this.verticalScroll._handleDownEvent.call( this, e.clientY );

      this.verticalScroll._wrapMoveEvent = function(e){ that.verticalScroll.moveEvent.call( this, e ); };
      this.verticalScroll._wrapUpEvent = function(e){ that.verticalScroll.upEvent.call( this, e ); };

      this.verticalScroll._wrapMoveEvent = _.bind(this.verticalScroll._wrapMoveEvent, this);
      this.verticalScroll._wrapUpEvent = _.bind(this.verticalScroll._wrapUpEvent, this);

      if ( this.isMobile ) {
        document.body.addEventListener('touchmove', this.verticalScroll._wrapMoveEvent, true);
        document.body.addEventListener('touchend', this.verticalScroll._wrapUpEvent, true);
      } else {
        document.body.addEventListener('mousemove', this.verticalScroll._wrapMoveEvent, true);
        document.body.addEventListener('mouseup', this.verticalScroll._wrapUpEvent, true);
      }
    },
    _moveEvent : function(clientY) {
      if ( !this.verticalScroll.pos ) {
        return;
      }
      var topRange = this.$scrollYArea.height() - this.$scrollYHandle.height(),
          top = parseInt( this.verticalScroll.pos.top + clientY - this.verticalScroll.pos.currentY, 10),
          scrollYRange = this.wholeTblHeight - 20 * this.viewModel.getOption("rowNum"),
          scrollTop = top * scrollYRange / topRange;

      this.viewModel.setOption("scrollTop", scrollTop);
    },
    moveEvent : function(e) {
      if ( this.isMobile ) {
        e.preventDefault();
      }

      this.verticalScroll._moveEvent.call( this, this.isMobile ? e.touches[0].clientY : e.clientY );
    },
    _upEvent : function() {
      this.verticalScroll.pos = null;
    },
    upEvent : function() {
      this.verticalScroll._upEvent.call(this);

      if ( this.isMobile ) {
        document.body.removeEventListener('touchmove', this.verticalScroll._wrapMoveEvent, true);
        document.body.removeEventListener('touchend', this.verticalScroll._wrapUpEvent, true);
      } else {
        document.body.removeEventListener('mousemove', this.verticalScroll._wrapMoveEvent, true);
        document.body.removeEventListener('mouseup', this.verticalScroll._wrapUpEvent, true);
      }
    }
  },    
  horizontalScroll : {
    pos : null,
    _wrapMoveEvent: null,
    _wrapUpEvent: null,

    _areaDownEvent : function(offsetX) {
      var left = this.$scrollXHandle.position().left,
          leftRange = this.$scrollXArea.width() - this.$scrollXHandle.width(),
          scrollLeft = left * (this.wholeTblWidth - this.tableWidth) / leftRange,
          frozenArea = this.viewModel.getFrozenArea();

      scrollLeft += (offsetX < left ? -1 : 1) * (this.tableWidth - frozenArea);
      this.viewModel.setOption("scrollLeft", scrollLeft);
    },
    areaDownEvent : function(e) {
      var x = e.offsetX || e.pageX - $(e.target).offset().left;
      this.horizontalScroll._areaDownEvent.call( this, x );
    },
    _handleDownEvent : function(clientX) {
      this.horizontalScroll.pos = {
        left : this.$scrollXHandle.position().left,
        currentX : clientX
      };
    },
    handleDownEvent : function(e) {
      var that = this;

      e.preventDefault();
      e.stopPropagation();

      if ( this.isMobile ) {
        if ( e.originalEvent.touches ) {
          e = e.originalEvent.touches[0];
        } else {
          return false;
        }
      }

      this.horizontalScroll._handleDownEvent.call( this, e.clientX );

      this.horizontalScroll._wrapMoveEvent = function(e){ that.horizontalScroll.moveEvent.call( this, e ); };
      this.horizontalScroll._wrapUpEvent = function(e){ that.horizontalScroll.upEvent.call( this, e ); };

      this.horizontalScroll._wrapMoveEvent = _.bind(this.horizontalScroll._wrapMoveEvent, this);
      this.horizontalScroll._wrapUpEvent = _.bind(this.horizontalScroll._wrapUpEvent, this);

      if ( this.isMobile ) {
        document.body.addEventListener('touchmove', this.horizontalScroll._wrapMoveEvent, true);
        document.body.addEventListener('touchend', this.horizontalScroll._wrapUpEvent, true);
      } else {
        document.body.addEventListener('mousemove', this.horizontalScroll._wrapMoveEvent, true);
        document.body.addEventListener('mouseup', this.horizontalScroll._wrapUpEvent, true);
      }
    },
    _moveEvent : function(clientX) {
      if ( !this.horizontalScroll.pos ) {
        return;
      }
      var leftRange = this.$scrollXArea.width() - this.$scrollXHandle.width(),
          left = parseInt( this.horizontalScroll.pos.left + clientX - this.horizontalScroll.pos.currentX, 10),
          scrollXRange = this.wholeTblWidth - this.tableWidth,
          scrollLeft = left * scrollXRange / leftRange;

      this.viewModel.setOption("scrollLeft", scrollLeft);
    },
    moveEvent : function(e) {
      if ( this.isMobile ) {
        e.preventDefault();
      }

      this.horizontalScroll._moveEvent.call( this, this.isMobile ? e.touches[0].clientX : e.clientX );
    },
    _upEvent : function() {
      this.horizontalScroll.pos = null;
    },
    upEvent : function() {
      this.horizontalScroll._upEvent.call(this);

      if ( this.isMobile ) {
        document.body.removeEventListener('touchmove', this.horizontalScroll._wrapMoveEvent, true);
        document.body.removeEventListener('touchend', this.horizontalScroll._wrapUpEvent, true);
      } else {
        document.body.removeEventListener('mousemove', this.horizontalScroll._wrapMoveEvent, true);
        document.body.removeEventListener('mouseup', this.horizontalScroll._wrapUpEvent, true);
      }
    }
  },
  scrollByWheel : {
    wheelEvent : function(e) {
      var ev = e.originalEvent || e,
          deltaX = 0,
          deltaY = 0;

      if ( e.target.tagName !== "TD" ){
        return;
      }

      if ( 'detail'      in ev ) { deltaY = ev.detail;        }
      if ( 'wheelDelta'  in ev ) { deltaY = ev.wheelDelta * -1;  }
      if ( 'wheelDeltaY' in ev ) { deltaY = ev.wheelDeltaY * -1; }
      if ( 'wheelDeltaX' in ev ) { deltaX = ev.wheelDeltaX * -1; }
      if(Math.abs(deltaY) < 40 ) {
        //   3 -> 60 (3 lines)
        deltaY *= 20;
      } else {
        // 120 -> 60 (3 lines)
        deltaY /= 2;
      }

      this.scrollBy(deltaX, deltaY);

      e.preventDefault();
      e.stopPropagation();
    }
  },
  clickCell: {
    clickEvent : function(e) {
      var row = $(e.target).closest("tr").index() + this.rowTop,
          tdCol = $(e.target).closest("td").index(),
          frozenColumn = this.viewModel.getOption("frozenColumn"),
          col = tdCol < frozenColumn ? tdCol : tdCol + this.startCol - frozenColumn,
          displayType = this.viewModel.getMeta( [row, col], "displayType");

      this.setFocusedCell( row, col, e.target.tagName === 'TD' );

      if ( cellObjects[displayType][e.type] ) {
        cellObjects[displayType][e.type]( e, this, row, col );
      }
    }
  },
  onModelChange: function ( model, options ) {
    var rowIndex = model.collection.indexOf(model),
        events = this.gridEventMatch["change"] || [],
        eventObj = options.eventObj || { type: "change" },
        displayType = '',
        result = {};

    result.rowIndex = rowIndex;
    if ( options.status ) {
      _.extend( result, options.status );
    }

    _.each( model.changed, function( data, colID ) {
      result.colID = colID;

      displayType = this.viewModel.getMeta( [rowIndex, colID], "displayType" );
      if ( !options.status && cellObjects[displayType].completedOptions ) {
        result = cellObjects[displayType].completedOptions( this, result, rowIndex, colID, data, model );
      }

      this.fireGridEvent( events, model.cid, colID, eventObj, result, true );

      if ( !options.noDraw ) {
        this.drawCell(rowIndex, colID);
      }
    }, this);
  },
  onModelAddRemove: function ( model, collection, options ) {
    var index = collection.indexOf(model);
    if ( index === -1 ) {
      index = options.index || 0;
    }
    this.drawPartial(index);
  },
  onReset: function () {
    if ( this.$wrapper_div ) {
      this.viewModel.setOption("scrollLeft", 0, {silent:true});
      this.viewModel.setOption("scrollTop", 0, {silent:true});
      this.createTbody();
      this.setResize();
    }
  },
  drawPartial: function(idx) {
    this.wholeTblHeight = this.getWholeTblHeight();

    if ( this.viewModel.getDataLength() < this.viewModel.getOption("rowNum") ) {
      this.setResize();
    } else if ( this.rowTop !== 0 && this.rowTop > idx || this.getRowLength() - this.viewModel.getOption('rowNum') < idx ) {
      this.viewModel.setOption( 'scrollTop', idx * 20 );
    } else {
      this.drawTbody( idx );
    }
  },
  drawWhole: function ( model ) {
    if ( model instanceof Collection ) {
      this.onReset();
    }
  },
  drawMetaByPos: function ( model ) {
    var i, idx;

    if( model.hasChanged('width') || model.hasChanged('flex') || model.hasChanged('hidden') ) {
      if( model.type === "column" ) {
        if ( model.hasChanged('width') ) {
          model.set('flex', null, { silent: true } );
        }

        this.viewModel.updateVisibleCol();
        this.setResize();

        if ( model.hasChanged('width') ) {
          this.trigger( 'adjustColumn', { type: 'adjustColumn' }, {
            colID: model.colID,
            beforeWidth: model.previous('width') ? model.previousAttributes().width.value : this.viewModel.metaDefaultObject['width'],
            width: model.get('width').value
          });
        }
      }
      return;
    }

    if( model.hasChanged('collapsed') && model.type === "row" ) {
      idx = model.get('id').split(',');
      idx[0] = this.viewModel.getMetaIndex(idx[0]);
      this.viewModel.toggleGroup( idx[0] );
    }

    if ( model.type === 'table' ) {
      this.drawTbody();
    } else if ( model.type === "row" || _(model.changed).keys().length > 1 ) {
      idx = this.viewModel.getMetaIndex(model.id);
      this.drawTbody(idx, idx);
    } else if ( model.type === "column" ) {
      idx = model.get('id');
      for ( i = this.rowTop; i < this.rowTop + this.viewModel.getOption("rowNum"); i++ ) {
        this.drawCell( i, idx );
      }
    } else {
      idx = model.get('id').split(',');
      idx[0] = this.viewModel.getMetaIndex(idx[0]);
      this.drawCell( idx[0], idx[1] );
    }
  },
  drawByScroll: function() {
    if(!this.$el) {
      return;
    }
    var scrollLeft = this.viewModel.getOption("scrollLeft"),
        scrollTop = this.viewModel.getOption("scrollTop"),
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        scrollXRange = this.wholeTblWidth - this.tableWidth,
        scrollYRange = this.wholeTblHeight - 20 * this.viewModel.getOption("rowNum"),
        $frozenDiv = this.$(".frozenHandle"),
        $cols = this.$("colgroup col"),
        frozenArea = this.viewModel.getFrozenArea(),
        visibleCol = this.viewModel.getVisibleCol(),
        topRange, leftRange,
        widthSum = 0,
        startCol = -1,
        endCol = -1,
        drawFlag = false,
        yAreaHeight, yHandleHeight,
        xAreaWidth, xHandleWidth,
        left, i, colWidth, top, rowTop,
        $th,
        innerCellView;

    // handle scrollLeft
    if ( scrollLeft > scrollXRange ) {
      scrollLeft = scrollXRange;
    }
    if ( scrollLeft < 0 ) {
      scrollLeft = 0;
    }
    scrollLeft = parseInt( scrollLeft, 10 );
    this.viewModel.setOption( "scrollLeft", scrollLeft, { silent: true } );

    // set frozenArea
    $frozenDiv.css( "left", frozenArea ).toggleClass("hide", !frozenArea).toggleClass("show", !!frozenArea);
    this.$scrollXArea.css( "left", frozenArea );

    for ( i = frozenColumn; i < visibleCol.length; i++ ) {
      colWidth = this.viewModel.getMeta( ["*", i], "width" );
      widthSum += colWidth;

      if ( startCol === -1 ) {
        if ( widthSum - colWidth / 2 > scrollLeft ) {
          startCol = endCol = i;
          widthSum = colWidth;
        }
      } else {
        endCol = i;
        if ( widthSum > this.$scrollXArea.width() ) {
          break;
        }
      }
    }

    if ( this.startCol !== startCol || this.endCol !== endCol ) {
      this.startCol = startCol;
      this.endCol = endCol;
      for ( i = $cols.length; i <= endCol - startCol + frozenColumn; i++ ) {
        this.$("colgroup").append("<col>");
        this.$("thead tr").append("<th class='gGrid-headerLabel' scope='col'>"+
                                           "<div class='gGrid-headerLabelWrap'>"+
                                           "<div class='gGrid-headerLabelText'>"+
                                         "</th>");
        this.$("tbody tr").append("<td>");
      }
      $cols = this.$("colgroup col");

      this.$('table').width( widthSum + frozenArea );
      _($cols).each(function (col, i) {
        var colIndex = i < frozenColumn ? i : i + startCol - frozenColumn;
        var width = colIndex <= endCol ? this.viewModel.getMeta( ["*", colIndex], "width") : 0;
        
        $(col).width( width );
        if ( width === 0 ) {
          innerCellView = this.viewModel.getMeta( ["*", colIndex], "innerCellView", { noncomputed: true } );
          if ( innerCellView ) {
            innerCellView.remove();
            this.viewModel.removeMeta( ["*", colIndex], "innerCellView", { silent: true } );
          }
          $th = $(this.getHeaderCell(0, i));
          $th.off('mouseenter').off('mouseleave');
          $th.children(0).html("");
        }
      }, this);
      drawFlag = true;
    }

    // handle scrollTop
    if ( scrollTop > scrollYRange ) {
      scrollTop = scrollYRange;
    }
    if ( scrollTop < 0 ) {
      scrollTop = 0;
    }
    scrollTop = parseInt(scrollTop, 10);
    this.viewModel.setOption( "scrollTop", scrollTop, { silent: true } );

    rowTop = parseInt(scrollTop / 20, 10);
    if ( this.rowTop !== rowTop ) {
      this.rowTop = rowTop;
      drawFlag = true;
    }

    if ( drawFlag ) {
      this.drawHeader();
      this.drawTbody();
      this.setFocusedCell();
    }

    yAreaHeight = this.$scrollYArea.height();
    yHandleHeight = this.$("tbody tr").length * yAreaHeight / this.viewModel.getDataLength();
    yHandleHeight = ( this.scrollYHandleMinHeight > yHandleHeight ) ? this.scrollYHandleMinHeight : yHandleHeight;

    // calculate scrollXHandle's width and left
    xAreaWidth = this.$scrollXArea.width();
    xHandleWidth = xAreaWidth * this.tableWidth / this.wholeTblWidth;
    xHandleWidth = ( this.scrollXHandleMinWidth > xHandleWidth ) ? this.scrollXHandleMinWidth : xHandleWidth;

    topRange = yAreaHeight - yHandleHeight;
    top = parseInt(scrollTop * topRange / scrollYRange + 0.5, 10);
    this.$scrollYHandle.css( "top", top + "px" );
    this.$scrollYHandle.height( yHandleHeight );

    if ( yAreaHeight <= yHandleHeight ) {
      this.$scrollYArea.css( { "opacity": 0, "-ms-filter": "progid:DXImageTransform.Microsoft.Alpha(Opacity=0)" } );
    } else {
      this.$scrollYArea.css( { "opacity": 1, "-ms-filter": "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)" } );
    }

    leftRange = xAreaWidth - xHandleWidth;
    // left : leftRange = scrollLeft : scrollXRange
    left = leftRange * scrollLeft / (this.wholeTblWidth - this.tableWidth);
    this.$scrollXHandle.css("left", left + "px");
    this.$scrollXHandle.width( xHandleWidth );

    if ( xAreaWidth <= xHandleWidth ) {
      this.$scrollXArea.css( { "opacity": 0, "-ms-filter": "progid:DXImageTransform.Microsoft.Alpha(Opacity=0)" } );
    } else {
      this.$scrollXArea.css( { "opacity": 1, "-ms-filter": "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)" });
    }
  },
  onOptionChange: function ( model ) {
    if ( model.hasChanged("colOrder") ) {
      this.viewModel.updateVisibleCol();
      this.setResize();
    }
    if ( model.hasChanged("frozenColumn") ) {
      this.wholeTblWidth = this.getWholeTblWidth();
      this.viewModel.setOption("scrollLeft", 0, {silent:true});
      this.drawByScroll();

      this.trigger( 'frozenColumn', { type: 'frozenColumn' }, {
        oldFrozenColumn: model.previous('frozenColumn') ? model.previous('frozenColumn') : this.viewModel.optionDefaultObject['frozenColumn'],
        frozenColumn: model.changedAttributes().frozenColumn
      });
    }
    if ( model.hasChanged("scrollTop") || ( model.hasChanged("scrollLeft") && !model.hasChanged("frozenColumn") ) ) {
      this.drawByScroll();
    }
    if ( model.hasChanged("width") ) {
      this.$el.css( "width", model.get("width") );
      this.setResize();
    }
  },
  getHeaderCell: function ( rowNum, colNum ) {
    return this.$( "table thead tr:nth-child(" + ( rowNum + 1 ) + ") th:nth-child(" + ( colNum + 1 ) + ")")[0];
  },
  getTbodyCell: function ( rowNum, colNum ) {
    return this.$( "table tbody tr:nth-child(" + ( rowNum + 1 ) + ") td:nth-child(" + ( colNum + 1 ) + ")")[0];
  },
  // getFooterCell: function ( rowNum, colNum ) {
  // return this.$el.find("table tfoot tr:nth-child(" + (rowNum + 1) + ")").find(
  //   "td:nth-child(" + (colNum + 1) + ")")[0];
  // },
  getWholeTblWidth: function () {
    var widthSum = 0,
        last = -1,
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        frozenArea = this.viewModel.getFrozenArea(),
        visibleCol = this.viewModel.getVisibleCol(),
        colWidth, i;

    for(i = visibleCol.length - 1; i >= frozenColumn; i--) {
      colWidth = this.viewModel.getMeta( ["*", i], "width" );
      if(i !== visibleCol.length - 1 && widthSum + colWidth > this.tableWidth - frozenArea) {
        last = i;
        break;
      }
      widthSum += colWidth;
    }
    widthSum = 0;
    for(i = frozenColumn; i <= last; i++) {
      widthSum += this.viewModel.getMeta( ["*", i], "width" );
    }
    return widthSum + this.tableWidth;
  },
  getWholeTblHeight: function () {
    return 20 * this.viewModel.getDataLength();
  },
  drawHeader: function () {
    var frozenColumn = this.viewModel.getOption("frozenColumn");

    // frozenColumn 까지
    for(var j = 0; j < frozenColumn; j++) {
      this.drawHeaderCell( 0, j );
    }
    // frozenColumn 이후
    for(j = this.startCol; j <= this.endCol; j++) {
      this.drawHeaderCell( 0, j );
    }
  },
  drawTbody: function (rowStart, rowEnd) {
    var i,
        frozenColumn = this.viewModel.getOption("frozenColumn");
        rowStart = rowStart || this.rowTop;

    if(arguments.length < 2) {
      rowEnd = this.rowTop + this.viewModel.getOption('rowNum') - 1;
    }

    for ( i = rowStart; i <= rowEnd; i++ ) {
      // frozenColumn 까지
      for(var j = 0; j < frozenColumn; j++) {
        this.drawCell( i, j);
      }
      // frozenColumn 이후
      for(j = this.startCol; j <= this.endCol; j++) {
        this.drawCell( i, j);
      }
    }
  },
  drawHeaderCell: function ( row, col ) {
    var colIndex = this.viewModel.getColIndex(col),
        colOrder = this.viewModel.getOption("colOrder"),
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        visibleCol = this.viewModel.getVisibleCol(),
        colID = this.viewModel.getColID(col),
        tdCol = colIndex < frozenColumn ? colIndex : colIndex-this.startCol+frozenColumn,
        filtered = false,
        cell = this.getHeaderCell(0, tdCol),
        $cell = $(cell),
        label = this.viewModel.getMeta( ["*", col], "headerLabel"),
        $labelNode = $("<div class='gGrid-headerLabelText'></div>"),
        $sortStateNode = $("<i class='w5-grid-sort'></i>" ),
        headerDisplayType = this.viewModel.getMeta( ['*', col], 'headerDisplayType', { noncomputed: true } ),
        innerCellView,
        that;

    if (cell) {
      if ( headerDisplayType ) {
        that = this;
        innerCellView = this.viewModel.getMeta( ["*", col], "innerCellView", { noncomputed: true } );
        if ( innerCellView ) {
          innerCellView.remove();
        }
        innerCellView = new cellViews[headerDisplayType]( $labelNode, that, label, [row, col] );
        this.viewModel.setMeta( ["*", col], "innerCellView", innerCellView, { silent: true } );

        $labelNode.append( innerCellView );
      } else {
        $labelNode.append(label);
      }

      if ( this.viewModel.getMeta( ["*", col], "sortable" ) !== false ) {
        $labelNode.append($sortStateNode);
      }

      $cell.off('mouseenter').off('mouseleave');

      // display filtered column header
      if ( !this.isBasic ){
        if ( this.filter_menu_html ){
          if ( _.indexOf( this.viewModel.collection.filterInfo.column_list, colID ) > -1 ){
            filtered = true;
            $cell.addClass("filter-column");
            
          } else{
            filtered = false;
            $cell.removeClass("filter-column");
          }
        } else {
          this.filter_menu_html = {};
        }
      }

      $cell.attr("abbr", label).children(0).html("")
          .append($labelNode)
          .append(this.getColMenu(colIndex, tdCol, filtered))
          .append(this.getAdjustColHandle(colIndex));
    }

    // Left show button show/hide
    var idx = _(colOrder).indexOf(visibleCol[col]),
        leftColumnID = colOrder[idx - 1];

    if( idx === 0 || _(visibleCol).indexOf(leftColumnID) >= 0 ) {
      $cell.find(".display-left .w5-grid-column-show").addClass("hide");
    } else {
      $cell.find(".display-left .w5-grid-column-show").removeClass("hide");
    }

    // display sort status icon
    var column = this.collection.sortInfo.column || [],
        direction = this.collection.sortInfo.direction || [],
        btnClass = ["state-none", "state-asc", "state-desc"],
        textNode = ["Sort None", "Sort Ascending", "Sort Descending"],
        index = _.indexOf( column, colID ),
        sortState = index === -1 ? 0 : ( ( direction[index] || 'asc' ) === "asc" ? 1 : 2 );

    $cell.find(".w5-grid-sort").addClass(btnClass[sortState])
        .removeClass(btnClass[(sortState + 1) % 3])
        .removeClass(btnClass[(sortState + 2) % 3])
        .text(textNode[sortState]);
  },
  drawCell: function ( row, col ) {
    var colIndex = this.viewModel.getColIndex(col),
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        inColRange = colIndex < frozenColumn || (this.startCol <= colIndex && colIndex <= this.endCol),
        inRowRange = this.rowTop <= row && row < this.rowTop + this.viewModel.getOption("rowNum"),
        tdCol = colIndex < frozenColumn ? colIndex : colIndex-this.startCol+frozenColumn,
        $cell, data, cellObject, $content, node, nodeFormatter, isNodeFormatter, style, className;

    if( !inColRange || !inRowRange ) {
      return;
    }
    $cell = $(this.getTbodyCell(row-this.rowTop, tdCol));

    if ( $cell.length > 0 ) {
      if ( row < this.viewModel.getDataLength() ) {
        data = this.viewModel.getData( [row, col] );
        cellObject = cellObjects[this.viewModel.getMeta( [row, col], "displayType" )];
        nodeFormatter = this.viewModel.getMeta( [row, col], "nodeFormatter" );

        if ( nodeFormatter && _.isFunction(nodeFormatter) ) {
          isNodeFormatter = true;
        }

        if ( isNodeFormatter && nodeFormatter.destroy && _.isFunction( nodeFormatter.destroy ) ) {
          nodeFormatter.destroy.call( this.view, $cell, data, this.viewModel.collection.at(row), row, this.viewModel.getColID(colIndex) );
        }

        $content = cellObject.getContent(this, data, row, colIndex);
        $cell.html("").append( $content );
        if ( _.isObject($content) && $content.data('afterProcess') ) {
          $content.data('afterProcess').run();
        }

        if ( isNodeFormatter ) {
          node = $cell.get(0);
          node = node.querySelector(':first-child');
          if ( node ) {
            nodeFormatter.call( this.view, $cell, node, data, this.viewModel.collection.at(row), row, this.viewModel.getColID(colIndex) );
          }
        }

        style = this.viewModel.getMeta( [row, col], "style" );
        className = this.viewModel.getMeta( [row, col], "className" ) || "";
      } else {
        $cell.html("");
        style = null;
        className = "";
      }
      $cell[0].style.cssText = "";
      if ( style ) {
        $cell.css( style );
      }

      $cell.attr( "class", className );
    }
  },
  getAdjustColHandle: function () {
    var grid = this;

    var adjustCol = {
      $adjustHandle     : $("<i class='adjustCol-handle'>Adjust this Column</i>"),
      $adjustCol_start  : grid.$(".adjustCol-start"),
      $adjustCol_move   : grid.$(".adjustCol-move"),
      targetCol         : 0,
      targetColW        : 0,
      targetColLeft     : 0,
      draggingX         : 0,
      colDragInfo       : {},    //변하는 중인 col의 width

      downEvent : function(e) {
        var $targetTH = $(e.target).parent().closest("th");

        this.targetCol      = $targetTH.index();
        this.targetColW     = $targetTH.width();
        this.targetColLeft  = $targetTH.position().left;

        this.colDragInfo = {
          posX : e.clientX,
          startX : this.targetColLeft + this.targetColW
        };

        this.$adjustCol_start.css("left", this.colDragInfo.startX);
        this.$adjustCol_start.removeClass("hide").addClass("show");
        this.$adjustCol_move.css("left", this.colDragInfo.startX);
        this.$adjustCol_move.removeClass("hide").addClass("show");

        document.body.addEventListener('mousemove', this.moveEvent, true);
        document.body.addEventListener('mouseup', this.upEvent, true);

        e.stopPropagation();
      },
      moveEvent : function(e) {
        this.draggingX = e.clientX - this.colDragInfo.posX;
        this.$adjustCol_move.css("left", this.colDragInfo.startX+this.draggingX-this.$adjustCol_move.width());
        $("body").addClass("sizingH");
      },
      upEvent : function() {
        var colWidth, frozenColumn;

        if ( this.targetColW + this.draggingX > 0 ) {
          frozenColumn = grid.viewModel.getOption("frozenColumn");
          if ( this.targetCol >= frozenColumn ) {
            this.targetCol += grid.startCol - frozenColumn;
          }

          colWidth = grid.viewModel.getMeta( ["*", this.targetCol], "width" );
          grid.viewModel.setMeta( ["*", this.targetCol], "width", colWidth + this.draggingX );
        }

        this.$adjustCol_start.removeClass("show").addClass("hide");
        this.$adjustCol_move.removeClass("show").addClass("hide");
        $("body").removeClass("sizingH");

        document.body.removeEventListener('mousemove', this.moveEvent, true);
        document.body.removeEventListener('mouseup', this.upEvent, true);
      }
    };
    
    _(adjustCol).bindAll("downEvent", "moveEvent", "upEvent");
    adjustCol.$adjustHandle.on("mousedown", adjustCol.downEvent);

    return adjustCol.$adjustHandle;
  },
  colLeftMenu: _.template(
      "<div class='gGrid-colMenu display-left'>"+
        "<button type='button' class='w5-grid-column-show'>Show hide column</button>"+
      "</div>"
  ),
  colRightMenu: _.template(
    "<div class='gGrid-colMenu display-right hide'>"+
      "<button type='button' class='w5-grid-colMenu-icon'>Open this column menu</button>"+ 
      "<ul role='menu' class='w5-dropdown-menu form-none'>"+
      "<li><a href='#' role='menuitem' class='w5-dropdown-menu-label column-hide'>Column Hide</a></li>"+
      "<li><a href='#' role='menuitem' aria-disabled='false' class='w5-dropdown-menu-label frozen-column'>Set Frozen Column</a></li>"+
      "</ul>"+
    "</div>"
  ),
  getColMenu: function ( col, tdCol, filtered ) {
    var grid = this,
        colID = grid.viewModel.getColID( col ),
        $colMenu = $(document.createDocumentFragment()),
        $leftMenu = $(this.colLeftMenu()),
        $rightMenu = $(this.colRightMenu()),
        $menuIcon = $rightMenu.find(".w5-grid-colMenu-icon"),
        colOrder = grid.viewModel.getOption("colOrder"),
        visibleCol = grid.viewModel.getVisibleCol(),
        frozenCol = grid.viewModel.getOption("frozenColumn"),
        scrollLeft = grid.viewModel.getOption("scrollLeft");

    var leftMenu = {
      _showCol : function () {
        var from = _(colOrder).indexOf(visibleCol[col]) - 1,
            to = _(colOrder).indexOf(visibleCol[col-1]),
            i;

        if ( col>=frozenCol ){
          for( i = from; i >= to && i >= 0 ; i-- ) {
            grid.viewModel.setMeta(["*", colOrder[i]], "hidden", false);
          }
          grid.viewModel.updateVisibleCol();
        } else {
          throw new Error( "Section of the column to a frozen column can not be show. \n" +
                           "First, turn off the frozen column." );
        }
      },
      showCol : function(e) {
        this._showCol(e.target);
      }
    };

    _(leftMenu).bindAll("showCol");
    $leftMenu.find(".w5-grid-column-show").on("click", leftMenu.showCol);
    $colMenu.append($leftMenu);

    var rightMenu = {
      _openColMenu : function( menuBtn ) {
        var checkMenuPos = 0,
            $cell = $(menuBtn).closest("th"),
            colIdx = $cell.index(),
            i;

        grid.$("thead th .display-right").removeClass("open");
        grid.$("thead th .display-right .w5-grid-colMenu-icon").removeClass("on");
        $rightMenu.addClass("open");
        $(menuBtn).addClass("on");

        for ( i=0; i<=colIdx; i++ ){
          checkMenuPos += grid.$("thead th").eq(i).width();
        }
        if ( checkMenuPos > grid.$wrapper_div.width()-$cell.find(".display-right .w5-dropdown-menu").width() ){
          $cell.find(".display-right .w5-dropdown-menu").css({
            left : "auto",
            right : "0px"
          });
        }
      },
      openColMenu : function(e){
        this._openColMenu(e);
      },
      _closeColMenu : function () {
        $rightMenu.removeClass("open");
        $menuIcon.removeClass("on");
      },
      closeColMenu : function(){
        this._closeColMenu();
      },
      _hideCol : function () {
        var remainCol = grid.viewModel.getVisibleCol().length;

        if ( remainCol!==1 ){
          if ( col>=frozenCol ){
            grid.viewModel.setMeta(["*", col], "hidden", true);
            grid.viewModel.updateVisibleCol();
          } else {
            throw new Error( "Section of the column to a frozen column can not be hidden.\nFirst, turn off the frozen column." );
          }
        } else {
          throw new Error( "W5 Grid is must have a column." );
        }
      },
      hideCol : function ( e ) {
        this._hideCol( e.target );
        e.preventDefault();
      },
      _frozenCol : function () {
        grid.viewModel.setOption("frozenColumn", col+1 );
      },
      frozenCol : function ( e ) {
        this._frozenCol(e);
        e.preventDefault();
      },
      clearNextFormEls : function( $el ) {
        $el.nextAll().remove();
      },
      changeDataCondition : function( event ) {
        var $selectedEl = $( event.target ),
            $parent = $selectedEl.parent(),
            $newEl,
            selectedValue = event.target.value;

        if ( ( selectedValue === "textContains" ) ||
             ( selectedValue === "textDoesNotContain" ) ||
             ( selectedValue === "textIsExactly" ) ||
             ( selectedValue === "cellIsEmpty" ) ){

          this.clearNextFormEls( $selectedEl );
          $selectedEl.removeClass("select-sm").addClass("select-lg");
          $newEl = $( grid.filterTemplate_input() );
          $newEl.removeClass("input-xs").addClass("input-sm");
          $parent.append( $newEl );
        }

        if ( ( selectedValue === "dateIs" ) ||
             ( selectedValue === "dateIsBefore" ) ||
             ( selectedValue === "dateIsAfter" ) ){

            this.clearNextFormEls( $selectedEl );
            $selectedEl.removeClass("select-sm").addClass("select-lg");
            $newEl = $( grid.filterTemplate_date() );
            $newEl.on("change", this.changeDateCondition );
            $parent.append( $newEl );
        }

        if ( ( selectedValue === "greaterThan" ) ||
             ( selectedValue === "lessThan" ) ||
             ( selectedValue === "isEqualTo" ) ||
             ( selectedValue === "isNotEqualTo" ) ||
             ( selectedValue === "isBetween" ) ||
             ( selectedValue === "isNotBetween" ) ){

            this.clearNextFormEls( $selectedEl );
            $selectedEl.removeClass("select-sm").addClass("select-lg");
            if ( ( selectedValue === "isBetween" ) ||
                 ( selectedValue === "isNotBetween" ) ){
              $parent.append( $(grid.filterTemplate_input()) );
              $parent.append( $(grid.filterTemplate_input()) );
            } else{
              $parent.append( $(grid.filterTemplate_input()).removeClass("select-xs").addClass("select-sm") );
            }
        }
      },
      changeDateCondition : function( event ) {
        var $selectedEl = $( event.target ),
            $newEl = $( grid.filterTemplate_input() ),
            $parent = $selectedEl.parent(),
            selectedValue = event.target.value;
        
        if ( selectedValue === "theDate" ){
          $selectedEl.prev().removeClass("select-lg").addClass("select-sm");
          $selectedEl.removeClass("select-lg").addClass("select-xs");
          $newEl.attr("placeholder","MM-DD-YYYY");
          $parent.append( $newEl );
        } else {
          this.clearNextFormEls( $selectedEl );
          $selectedEl.removeClass("select-xs").addClass("select-lg");
        }
      },
      addFilterMenu : function( event ) {
        var $targetLI = $( event.target ).closest("li"),
            $newLI = $( grid.filterTemplate() );

        $newLI.find(".condition-remove-btn").on( "click", this.removeFilterMenu );
        $targetLI.before( $newLI );

        if ( $targetLI.siblings().length > 4 ){
          $newLI.addClass("line-dashed");
        }
        if( ( this.$addConditionBtn.index() > 2 ) &&
              !this.$addConditionBtn.hasClass("line-dashed") ){
            this.$addConditionBtn.addClass("line-dashed");
        }

        $newLI.find(".w5-grid-form-select").eq(0).on( "change", this.changeDataCondition );
      },
      removeFilterMenu : function( event ) {
        var $LI = $(event.target).closest("li"),
            $siblings = $LI.siblings();
        
        $LI.remove();
        if ( $siblings.eq(2).hasClass("line-dashed") ){
          $siblings.eq(2).removeClass("line-dashed");
        }
        if ( this.$addConditionBtn.index() > 3 ){
          this.$addConditionBtn.addClass("line-dashed");
        }
      },
      applyFilter : function() {
        var condition = $rightMenu.find(".w5-grid-form .form-group"),
            conditionNum = condition.length,
            $conditionLI = condition.closest("li"),
            filteredColumns = grid.viewModel.collection.filterInfo.column_list,
            filterObj = {},
            formEl, tmpArr = [], i;
        filterObj[colID] = {};

        if ( conditionNum === 0 ){
          filterObj[colID] = null;
          grid.filter_menu_html[colID] = null;

          if ( filteredColumns.length === 1 && (_.indexOf( filteredColumns, colID ) >-1 )){
            grid.viewModel.filter();
          } else {
            grid.viewModel.filter( filterObj );
          }
        } else{

          for ( i=0; i<conditionNum; i++ ){
            formEl = condition.eq(i).children();

            if ( formEl.eq(0).val() === "isBetween" ||
                 formEl.eq(0).val() === "isNotBetween" ){
              tmpArr.push( formEl.eq(1).val(), formEl.eq(2).val() );
              filterObj[colID][formEl.eq(0).val()] = tmpArr;
           
            } else {
              if ( formEl.eq(1).val() === "theDate" ){
                filterObj[colID][formEl.eq(0).val()] = formEl.eq(2).val();
              } else {
                filterObj[colID][formEl.eq(0).val()] = formEl.eq(1).val();
              }
            }
          }
          
          grid.filter_menu_html[colID] = $conditionLI.clone();
          grid.viewModel.filter( filterObj );
        }
      },
      displayFilterCondition : function () {
        var selectNum;

        if ( grid.filter_menu_html[colID] ){
          grid.filter_menu_html[colID].find(".condition-remove-btn").on( "click", this.removeFilterMenu );
          
          selectNum = grid.filter_menu_html[colID].find(".w5-grid-form-select").length;
          grid.filter_menu_html[colID].eq(0).on( "change", this.changeDataCondition );
          if ( selectNum === 2 ){
            grid.filter_menu_html[colID].eq(1).on( "change", this.changeDateCondition );
          }
          
          this.$filterMenu.append( grid.filter_menu_html[colID] );
        }
      }
    };

    _(rightMenu).bindAll("openColMenu", "closeColMenu", "hideCol", "frozenCol",
     "clearNextFormEls", "changeDataCondition", "changeDateCondition", "addFilterMenu", "removeFilterMenu", "applyFilter", "displayFilterCondition");
    $rightMenu.find(".w5-grid-colMenu-icon").on("click", function(){
      if ( $(this).hasClass("on") ){
        rightMenu.closeColMenu( $(this) );
      } else{
        rightMenu.openColMenu( $(this) );
      }
    });  
    $rightMenu.find(".w5-dropdown-menu li").find(".column-hide").on("click", rightMenu.hideCol);  
    $rightMenu.find(".w5-dropdown-menu li").find(".frozen-column").on("click", rightMenu.frozenCol);

    grid.$("thead tr:first-child th").eq(tdCol).on("mouseenter", function(){
      $(this).find(".display-right").removeClass("hide");
    });
    grid.$("thead tr:first-child th").eq(tdCol).on("mouseleave", function(){
      $rightMenu.removeClass("open").addClass("hide");
      rightMenu.closeColMenu();
    });

    if ( this.viewModel.getMeta(["*", col], "colMenu")!=="hidden" ){
      if( scrollLeft!==0 || col+1===frozenCol ){
        $rightMenu.find(".frozen-column").attr("aria-disabled", true).addClass("disabled");
        $rightMenu.find(".frozen-column").off("click", rightMenu.frozenCol);  
      }

      if ( !this.isBasic ){
        rightMenu.$filterMenu      = $( document.createDocumentFragment() );
        rightMenu.$filterTemp      = $( this.filterTemplate() );
        rightMenu.$addConditionBtn = $( this.filterTemplate_addCondition() );
        rightMenu.$filterBtnSet    = $( this.filterTemplate_btnSet() );

        rightMenu.$addConditionBtn.find(".condition-add-btn").on( "click", rightMenu.addFilterMenu );
        rightMenu.$filterBtnSet.find(".btn-normal.color-blue").on( "click", rightMenu.applyFilter );
        rightMenu.$filterBtnSet.find(".btn-normal.color-gray").on( "click", rightMenu.closeColMenu );

        if ( filtered ){
          rightMenu.displayFilterCondition();
          rightMenu.$filterMenu.append( rightMenu.$addConditionBtn.addClass("line-dashed") )
                               .append( rightMenu.$filterBtnSet );
        } else {
          rightMenu.$filterMenu.append( rightMenu.$addConditionBtn )
                               .append( rightMenu.$filterBtnSet );
        }

        $rightMenu.find(".w5-dropdown-menu").removeClass("form-none").append( rightMenu.$filterMenu );
      }
      $colMenu.append($rightMenu);
    }
    return $colMenu;
  },
  setFlex: function () {
    var restWidth = this.tableWidth,
        widthSum = 0,
        flexArr = [],
        flexSum = 0;

    _(this.viewModel.getVisibleCol()).each( function(obj, col) {
      var flex = this.viewModel.getMeta( ["*", col], "flex");
      if ( _.isNumber(flex) ) {
        flexArr.push({
          col : col,
          flex : flex,
          diff : 0
        });
        flexSum += flex;
      } else {
        restWidth -= this.viewModel.getMeta( ["*", col], "width");
      }
    }, this );
    if(flexArr.length === 0) {
      return;
    }
    for ( var i = 0; i < flexArr.length; i++ ) {
      flexArr[i].width = parseInt(flexArr[i].flex * restWidth / flexSum, 10);
      widthSum += flexArr[i].width;
    }
    restWidth -= widthSum;
    for ( i = 0; i < restWidth; i++ ) {
      var min = Infinity, minIndex = -1;
      for ( var j = 0; j < flexArr.length; j++ ) {
        var diff = flexArr[j].diff + 1,
            width = flexArr[j].width;
        if ( min > diff * (widthSum / width) ) {
          min = diff * (widthSum / width);
          minIndex = j;
        }
      }
      flexArr[minIndex].diff += 1;
    }
    for ( i = 0; i < flexArr.length; i++ ) {
      var pos = ["*", flexArr[i].col];
      pos.silent = true;
      this.viewModel.setMeta( pos, "width", flexArr[i].width + flexArr[i].diff, {silent:true} );
    }
  },
  setResize: function() {
    this.tableWidth = this.$wrapper_div.width();
    this.setFlex();
    this.wholeTblWidth = this.getWholeTblWidth();
    this.wholeTblHeight = this.getWholeTblHeight();
    
    this.startCol = this.endCol = -1;

    this.createTbody();
    this.drawByScroll();
  },
  checkResize: function() {
    var width = this.$el.width();
    if(this.wrapper_width !== width) {
      this.wrapper_width = width;
      this.setResize();
    }
  },
  refresh: function() {
    this.setResize();
    this.trigger( 'refresh', { type: "refresh" } );
    return this;
  },
  scrollTo: function(xpos, ypos) {
    this.viewModel.setOption({
      scrollLeft: xpos || 0,
      scrollTop: ypos || 0
    });
    return this;
  },
  scrollBy: function(xnum, ynum) {
    this.viewModel.setOption({
      scrollLeft: this.viewModel.getOption("scrollLeft") + (xnum || 0),
      scrollTop: this.viewModel.getOption("scrollTop") + (ynum || 0)
    });
    return this;
  },
  moveColumn: function(fromCol, toCol) {
    var colOrder = this.viewModel.getOption("colOrder"),
        fromColumnID = colOrder[fromCol],
        toColumnID = colOrder[toCol],
        visibleCol = _( this.viewModel.getVisibleCol() ),
        visibleColInfo = [ visibleCol.indexOf( colOrder[fromCol] ), visibleCol.indexOf( colOrder[toCol] ) ],
        frozenColumn = this.viewModel.getOption( "frozenColumn" ) - 1,
        focusedCol = null,
        col, options;

    colOrder = colOrder.slice();
    col = colOrder.splice(fromCol, 1)[0];
    colOrder.splice(toCol, 0, col);

    if ( this.focusedCell ) {
      if ( visibleColInfo[0] === this.focusedCell.colIndex ) {
        focusedCol = visibleColInfo[1];
      } else if ( visibleColInfo[1] === this.focusedCell.colIndex ) {
        if ( visibleColInfo[0] > visibleColInfo[1] ) {
          focusedCol = visibleColInfo[1] + 1;
        } else {
          focusedCol = visibleColInfo[1] - 1;
        }
      }

      options = { oldColID: this.viewModel.getColID( this.focusedCell.colIndex ) };
    }

    if ( visibleColInfo[0] <= frozenColumn && visibleColInfo[1] > frozenColumn ) {
      this.viewModel.setOption( "frozenColumn", frozenColumn, { silent: true } );
    } else if ( visibleColInfo[0] > frozenColumn && visibleColInfo[1] <= frozenColumn ) {
      this.viewModel.setOption( "frozenColumn", frozenColumn + 2, { silent: true } );
    }

    this.viewModel.setOption("colOrder", colOrder);

    if ( focusedCol ) {
      this.setFocusedCell( this.focusedCell.rowIndex, focusedCol, null, options );
    }

    this.trigger( 'moveColumn', { type: 'moveColumn' }, {
      fromColumnIndex: fromCol,
      toColumnIndex: toCol,
      fromColumnID: fromColumnID,
      toColumnID: toColumnID
    });
    return this;
  },
  addRow: function () {
    this.viewModel.addRow.apply( this.viewModel, arguments );
    return this;
  },
  removeRow: function ( index, options ) {
    this.viewModel.removeRow( index, options );
    return this;
  },
  removedRow: function ( options ) {
    return this.viewModel.removedRow( options );
  },
  reset: function(data) {
    data = data || [];

    this.viewModel.table.clear({silent:true});
    this.viewModel.row.reset([], {silent:true});
    this.viewModel.column.reset([], {silent:true});
    this.viewModel.cell.reset([], {silent:true});

    _(this.viewModel.colModel).each(function(model, index) {
      _.chain(model).each( function( value, key ) {
        if( key !== 'id' ) {
          this.viewModel.setMeta( ["*", index], key, value, {inorder:true, silent:true} );
        }
      }, this);
    }, this);

    this.viewModel.collection.reset(data);
    return this;
  },
  sort: function ( columns, directions, options ) {
    this.viewModel.sort( columns, directions, options );
    return this;
  },
  getRowLength: function () {
    return this.viewModel.getDataLength();
  },
  getColLength: function() {
    return this.viewModel.getVisibleCol().length;
  },
  _getColLength: function() {
    return this.viewModel.getOption("colOrder").length;
  },
  getCollection: function() {
    return this.viewModel.collection;
  },
  setColumnVisible: function( col, visibility ) {
    var lastIdx,
        options = { inorder: true };

    if ( _.isNumber(col) ) {
      this.viewModel.setMeta( ["*", col], "hidden", !visibility, options );
    }
    if ( _.isArray(col) ) {
      options.silent = true;
      lastIdx = col.length - 1;
      _(col).each( function( item, index ) {
        if ( index === lastIdx ) {
          delete options.silent;
        }
        this.viewModel.setMeta( ["*", item], "hidden", !visibility, options );
      }, this);
    }
    return this;
  },
  getColumnVisibility: function(visibility){
    var colOrder = this.viewModel.getOption("colOrder"),
        visibleCol = this.viewModel.getVisibleCol();

    if ( visibility==="hidden" ){
      return _(colOrder).difference(visibleCol);
    } else { 
      return visibleCol;
    }
  },
  _cell: function (row, col) {
    return new GridSelector(this, [[row, this.viewModel.getColID(col, true)]]);
  },
  _row: function (row) {
    return new GridSelector(this, [[row, "*"]]);
  },
  _col: function (col) {
    return new GridSelector(this, [["*", this.viewModel.getColID(col, true)]]);
  },
  cell: function (row, col) {
    return new GridSelector(this, [[row, this.viewModel.getColID(col)]]);
  },
  row: function (row) {
    return new GridSelector(this, [[row, "*"]]);
  },
  col: function (col) {
    return new GridSelector(this, [["*", this.viewModel.getColID(col)]]);
  },
  table: function () {
    return new GridSelector(this, [["*", "*"]]);
  },
  option: function() {
    return this.viewModel.option;
  },
  fetch: function () {
    this.viewModel.fetch.apply( this.viewModel, arguments );
    return this;
  },
  getCUData: function ( options ) {
    return this.viewModel.getCUData( options );
  },
  syncData: function ( options ) {
    this.viewModel.syncData( options );
    return this;
  },
  getGridData: function () {
    return this.viewModel.getGridData();
  },
  setDefaults: function ( defaults ) {
    this.viewModel.setDefaults( defaults );
    return this;
  },
  getDefaults: function () {
    return this.viewModel.getDefaults();
  },
  setPseudo: function ( item, pseudo ) {
    if ( pseudo ) {
      item.pseudo = pseudo;
    }
    return item;
  },
  pushElems: function ( tagName, key1, length, compareTag, unique_check, elems, pseudo ) {
    var i, key2;

    if ( !tagName ||
       ( key1 === "*" && tagName === compareTag ) ||
       ( key1 !== "*" && tagName === "cell" ) ) {
      for ( i = 0; i < length; i++ ) {
        if ( compareTag === 'col' ) {
          key2 = this.viewModel.getColID(i);
        } else {
          if ( i === 0 ) {
            key2 = key1;
          }
          key1 = i;
        }
        if ( !unique_check[key1 + "_" + key2] ) {
          unique_check[key1 + "_" + key2] = 1;
          elems.push( this.setPseudo( [key1, key2], pseudo ) );
        }
      }
    }
  },
  getChildren: function( parentEls, tagName, attribute, pseudo ) {
    var unique_check = {},
        elems = [],
        i, k,
        row, col,
        attr,
        attrName, attrOperator, attrValue,
        newEls,
        val, valArr;

    for ( k = 0; k < parentEls.length; k++ ) {
      row = parentEls[k][0];
      col = parentEls[k][1];

      // add cols in table or cells in row
      if ( col === "*" ) {
        this.pushElems( tagName, row, this.viewModel.colModel.length, 'col', unique_check, elems, pseudo );
      }
      // add rows in table or cells in col
      if ( row === "*" ) {
        this.pushElems( tagName, col, this.collection.length, 'row', unique_check, elems, pseudo );
      }
      // add cells in table
      if ( row === "*" && col === "*" && ( !tagName || tagName === "cell" ) ) {
        for ( i = 0; i < this.collection.length; i++ ) {
          this.pushElems( false, i, this.viewModel.colModel.length, 'col', unique_check, elems, pseudo );
        }
      }
    }
    if ( attribute ) {
      attr = /\[([\w]+)(?:([\~\^\$\|\=]+)?\'(.+)\')?\]/g.exec(attribute);
      newEls = [];

      if ( attr ){
        attrName = attr[1];
        attrOperator = attr[2];
        attrValue = attr[3];
      } else {
        throw new Error( "Attribute value of selector must be wrapped single quotation marks." );
      }

      for ( i = 0; i < elems.length; i++ ) {
        if ( attrName === "data" ) {
          val = this.viewModel.getData(elems[i]);
        } else {
          val = this.viewModel.getMeta(elems[i], attrName);
        }

        switch ( attrOperator ){
        case "=" :
          if ( String(val) === attrValue ){
            newEls.push(elems[i]);
          }
          break;
        case "~=" :
          if ( attrName !== "data" ) {
            valArr = val.match(/\w+/g);
            if ( _.indexOf( valArr, attrValue ) !== -1 ){ newEls.push(elems[i]); }
          } else {
            if ( val.indexOf( attrValue ) !== -1 ){ newEls.push(elems[i]); }
          }
          break;
        default:
          if ( !_.isEmpty(val) ||
           !((attrName === "data") && _.isUndefined(attrValue)) ){
            newEls.push(elems[i]);
          }
          break;
        }
      }
      elems = newEls;
    }

    if ( pseudo && ( pseudo === 'row' || pseudo === 'col' ) ) {
      unique_check = {};
      newEls = [];
      for ( i = 0; i < elems.length; i++ ) {
        if ( elems[i][0] !== '*' && elems[i][1] !== '*' ) {
          if ( elems[i].pseudo === 'row' ) {
            if ( !unique_check[ elems[i][0] + "_*" ] ) {
              unique_check[ elems[i][0] + "_*" ] = true;
              elems[i][1] = '*';
              newEls.push(elems[i]);
            }
          } else {
            if ( !unique_check[ "*_" + elems[i][1] ] ) {
              unique_check[ "*_" + elems[i][1] ] = true;
              elems[i][0] = '*';
              newEls.push(elems[i]);
            }
          }
        }
      }
      elems = newEls;
    }

    return elems;
  },
  select: function( str, context, results, options ) {
    var sel, els, i, selector,
        checkedRegExr = /row:checked/,
        checkedValue,
        seen;

    options = options || {};

    if ( str.search( checkedRegExr ) > -1 ) {
      checkedValue = this.viewModel.getCheckValue();

      if ( checkedValue !== null ) {
        str = str.replace( checkedRegExr, "col[id='" + this.viewModel.getColID(0) + "'] cell[data='" + checkedValue + "']:row" );
      }
    }

    sel = str.match(/\w+(\[([\S]+)([\~\^\$\|\=]+\'(.+)\')?\])?(\:\w+)?/g);

    context = context || [["*", "*"]]; // default started with a table
    results = results || [];

    for ( i = 0; i < sel.length; i++ ) {
      selectorPattern[0].lastIndex = 0;
      selectorPattern[1].lastIndex = 0;

      if ( selectorPattern[0].test(sel[i]) ) {
        selector = selectorPattern[1].exec(sel[i]);
        els = this.getChildren( context, selector[1], selector[2], selector[3] );
        context = els;
      } else {
        els = [];
        break;
      }
    }
    Array.prototype.push.apply( results, els );

    if ( options.union ) {
      seen = {};
      results = _.reduce( results, function( list, value ) {
        if ( !seen[ value[0] + '_' + value[1] ] ) {
          seen[ value[0] + '_' + value[1] ] = true;
          list.push(value);
        }
        return list;
      }, []);
    }

    return new GridSelector( this, results );
  },
  addGridEvent: function(selector, eventFunc) {
    this.options.gridEvents = this.options.gridEvents || {};
    this.options.gridEvents[selector] = eventFunc;
    this.setGridEvents();
  },
  removeGridEvent: function(selector) {
    this.options.gridEvents = this.options.gridEvents || {};
    delete this.options.gridEvents[selector];
    this.setGridEvents();
  },
  triggerGridEvent: function( pos, event, options ) {
    var events = this.gridEventMatch[event];

    options = options || {};
    options.rowIndex = pos[0];
    options.colID = this.viewModel.getColID( pos[1], true );

    if ( events ) {
      this.fireGridEvent( events, this.viewModel.getDataCID( pos[0] ), pos[1], { type: event }, options, true );
    }
  },
  fireIndexChanged: function( indexInfo, options ) {
    options = options || {};
    indexInfo.oldColID = options.oldColID || this.viewModel.getColID( indexInfo.oldColIndex );
    indexInfo.colID = this.viewModel.getColID( indexInfo.colIndex );

    if ( indexInfo.oldRowIndex !== indexInfo.rowIndex ) {
      this.trigger( 'rowChanged', { type: "rowChanged" }, indexInfo );
    }
    if ( indexInfo.oldColIndex !== indexInfo.colIndex ) {
      this.trigger( 'colChanged', { type: "colChanged" }, indexInfo );
    }
  },
  clearFocusedCell: function() {
    var that = this;
    if ( this.focusedCell ) {
      cellObjects["text"].endEdit.call( cellObjects["text"], { type: 'blur' }, that );
      this.focusedCell = null;
      this.setFocusedCell();
    }
  },
  setFocusedCell: function( rowIndex, colIndex, isFocused, options ) {
    var indexInfo = {
      oldRowIndex: -1,
      oldColIndex: -1,
      oldColID: '',
      rowIndex: -1,
      colIndex: -1,
      colID: ''
    };

    if ( _.isUndefined(isFocused) || _.isNull(isFocused) ) {
      isFocused = true;
    }

    if ( this.focusedCell ) {
      indexInfo.oldRowIndex = this.focusedCell.oldRowIndex > -1 ? this.focusedCell.oldRowIndex : this.focusedCell.rowIndex;
      indexInfo.oldColIndex = this.focusedCell.oldColIndex > -1 ? this.focusedCell.oldColIndex : this.focusedCell.colIndex;
    }

    if ( arguments.length === 0 ) {
      if ( this.focusedCell ) {
        rowIndex = this.focusedCell.rowIndex;
        colIndex = this.focusedCell.colIndex;
      } else {
        this.$(".w5-grid-focused-cell").addClass("hide");
        return;
      }
    } else {
      this.focusedCell = {
        rowIndex : rowIndex,
        colIndex : colIndex
      };
    }
    indexInfo.rowIndex = rowIndex;
    indexInfo.colIndex = colIndex;

    this.$(".w5-grid-focused-cell").removeClass("hide");
    var trIndex = rowIndex - this.rowTop,
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        tdIndex = colIndex < frozenColumn ? colIndex : colIndex - this.startCol + frozenColumn,
        $td = this.$("tbody tr").eq(trIndex).find("td").eq(tdIndex);

    if ( colIndex >= frozenColumn && colIndex < this.startCol ) {
      tdIndex = -1;  
    }

    if ( $td.length === 0 || trIndex < 0 || tdIndex < 0 ) {
      this.$(".w5-grid-focused-cell").addClass("hide");
      return;
    }

    var top = $td.offset().top - this.$wrapper_div.offset().top,
        left = $td.offset().left - this.$wrapper_div.offset().left,
        right = this.$scrollYArea.width(),
        thickness = this.$(".border-top").height(),
        width = $td.outerWidth(),
        height = $td.outerHeight();

    if ( this.endCol === colIndex ){
      width -= ( right + thickness );
    }

    this.$(".border-top").css({
      top   : top,
      left  : left,
      right : right,
      width : width
    });
    this.$(".border-right").css({
      top   : top,
      left  : left + width,
      right : right,
      height: height + thickness
    });
    this.$(".border-bottom").css({
      top   : top + height,
      left  : left,
      right : right,
      width : width
    });
    this.$(".border-left").css({
      top   : top,
      left  : left,
      right : right,
      height: height
    });

    if ( !this.isMobile && isFocused ) {
      this.$editBox.focus();
    }

    this.fireIndexChanged( indexInfo, options );

    this.focusedCell.oldRowIndex = rowIndex;
    this.focusedCell.oldColIndex = colIndex;
  },
  handleKeydown: function(e) {
    if ( this.keydownEvents[e.keyCode] ) {
      this[this.keydownEvents[e.keyCode]].call( this, e );
    }
  },
  moveUp: function ( e, options ) {
    var rowIndex, colIndex,
        targetRow = options && options.targetRow,
        isForced = options && options.isForced;

    if ( this.focusedCell && ( isForced || this.checkEditBox( e.target.className, true ) ) ) {
      rowIndex = this.focusedCell.rowIndex;
      colIndex = this.focusedCell.colIndex;

      if ( !_.isNumber( targetRow ) ) {
        targetRow = rowIndex - 1;
      }

      if ( targetRow > -1 ) {
        this.focusedCell = {
          rowIndex: targetRow,
          colIndex: colIndex,
          oldRowIndex: rowIndex,
          oldColIndex: colIndex
        };

        if ( targetRow < this.rowTop ) {
          this.viewModel.setOption( "scrollTop", (targetRow) * 20 );
        } else {
          this.setFocusedCell( targetRow, colIndex );
        }
      }
    }
  },
  moveDown: function ( e, options ) {
    var rowIndex, colIndex,
        targetRow = options && options.targetRow,
        isForced = options && options.isForced;

    if ( this.focusedCell && ( isForced || this.checkEditBox( e.target.className, true ) ) ) {
      rowIndex = this.focusedCell.rowIndex;
      colIndex = this.focusedCell.colIndex;

      if ( !_.isNumber( targetRow ) ) {
        targetRow = rowIndex + 1;
      }

      if ( targetRow < this.getRowLength() ) {
        this.focusedCell = {
          rowIndex: targetRow,
          colIndex: colIndex,
          oldRowIndex: rowIndex,
          oldColIndex: colIndex
        };

        if ( targetRow >= this.rowTop + this.viewModel.getOption('rowNum') ) {
          this.viewModel.setOption( "scrollTop", (targetRow) * 20 );
        } else {
          this.setFocusedCell( targetRow, colIndex );
        }
      }
    }
  },
  moveLeft: function( e, options ) {
    var rowIndex, colIndex,
        targetCol = options && options.targetCol,
        isForced = options && options.isForced,
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        i, scrollLeft = 0;

    if ( this.focusedCell && ( isForced || this.checkEditBox( e.target.className, true ) ) ) {
      rowIndex = this.focusedCell.rowIndex;
      colIndex = this.focusedCell.colIndex;

      if ( !_.isNumber( targetCol ) ) {
        targetCol = colIndex - 1;
      }

      if ( targetCol >= 0 ) {
        this.focusedCell = {
          rowIndex: rowIndex,
          colIndex: targetCol,
          oldRowIndex: rowIndex,
          oldColIndex: colIndex
        };

        if ( targetCol < this.startCol ) {
          if ( targetCol < frozenColumn ) {
            this.setFocusedCell( rowIndex, targetCol );
          } else {
            for ( i = colIndex; i > targetCol - 1; i-- ) {
              scrollLeft += this.viewModel.getMeta( ["*", i], 'width' );
            }
            this.viewModel.setOption( "scrollLeft", this.viewModel.getOption( "scrollLeft" ) - scrollLeft );
          }
        } else {
          this.setFocusedCell( rowIndex, targetCol );
        }
      }
    }
  },
  moveRight: function( e, options ) {
    var rowIndex, colIndex,
        targetCol = options && options.targetCol,
        isForced = options && options.isForced,
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        i,
        curScrollLeft = 0,
        scrollLeft = 0;

    if ( this.focusedCell && ( isForced || this.checkEditBox( e.target.className, true ) ) ) {
      rowIndex = this.focusedCell.rowIndex;
      colIndex = this.focusedCell.colIndex; 

      if ( !_.isNumber( targetCol ) ) {
        targetCol = colIndex + 1;
      }

      if ( targetCol <= this.getColLength() - 1 ) {
        this.focusedCell = {
          rowIndex: rowIndex,
          colIndex: targetCol,
          oldRowIndex: rowIndex,
          oldColIndex: colIndex
        };

        if ( targetCol > this.endCol - 1 ) {
          curScrollLeft = this.viewModel.getOption( "scrollLeft" );

          if ( this.endCol === this.getColLength() - 1 ) {
            curScrollLeft += this.viewModel.getMeta( ["*", this.endCol], 'width' );
            if ( this.wholeTblWidth - this.tableWidth > curScrollLeft ) {
              this.viewModel.setOption( "scrollLeft", curScrollLeft );
            } else {
              this.setFocusedCell( rowIndex, targetCol );
            }
          } else {
            for ( i = this.startCol; i < targetCol; i++ ) {
              scrollLeft += this.viewModel.getMeta( ["*", i], 'width' );
            }
            this.viewModel.setOption( "scrollLeft", curScrollLeft + scrollLeft );
          }
        } else {
          if ( frozenColumn && frozenColumn === targetCol ) {
            this.viewModel.setOption( "scrollLeft", 0 );
          }

          this.setFocusedCell( rowIndex, targetCol );
        }
      }
    }
  },
  checkEditBox: function( classNm, isEdit ) {
    var result = false;
    if ( classNm === 'w5_grid_editbox' ) {
      if ( isEdit ) {
        if ( !this.$editBox.data('edit') ) {
          result = true;
        }
      } else {
        result = true;
      }
    }
    return result;
  },
  focusWidget: function( e ) {
    var displayType,
        $cell,
        focusSelector,
        readOnly;

    if ( this.focusedCell ) {
      var rowIndex = this.focusedCell.rowIndex,
          colIndex = this.focusedCell.colIndex,
          that = this;

      displayType = this.viewModel.getMeta( [rowIndex, colIndex], 'displayType' );
      readOnly = this.viewModel.getMeta( [rowIndex, colIndex], "readOnly");
      if ( displayType === 'text' ) {
        if ( this.$editBox.data("edit") ) {
          cellObjects["text"].endEdit.call( cellObjects["text"], e, that, { isForced: true } );
        } else {
          if ( !readOnly ) {
            cellObjects["text"].popupEditBox.call( cellObjects["text"], that, rowIndex, colIndex );
          }
        }
      } else {
        if ( !readOnly ) {
          $cell = this.getTbodyCell( rowIndex - this.rowTop, colIndex - this.startCol );
          if ( $cell ) {
            focusSelector = this.viewModel.getMeta( [rowIndex, colIndex], 'focusSelector' );
            if ( displayType === 'custom' && focusSelector ) {
              $( $cell ).find( focusSelector )[0].focus();
            } else {
              ( $cell.firstElementChild || $cell.children[0] ).focus();
            }
          }
        }
      }
      e.preventDefault();
    }
  },
  blurWidget: function(e) {
    var rowIndex, colIndex,
        displayType,
        that = this;

    if ( this.focusedCell ) {
      rowIndex = this.focusedCell.rowIndex;
      colIndex = this.focusedCell.colIndex;
      displayType = this.viewModel.getMeta( [rowIndex, colIndex], 'displayType' );

      if ( displayType === 'text' ) {
        cellObjects["text"].endEdit.call( cellObjects["text"], e, that, { isForced: true } );
      }
      this.setFocusedCell( rowIndex, colIndex );
    }
  },
  checkTabbableItem: function( item ) {
    return _.contains( this.tabbableElements, item.type );
  },
  getActivatePosition: function ( isSift ) {
    var focusedCell = document.activeElement,
        $focusedCell,
        $focusedRow,
        nodelist,
        inputArray,
        runNative = false,
        cellIndex = null,
        rowIndex = null;

    if ( this.checkEditBox( focusedCell.className ) ) {
      if ( this.focusedCell ) {
        cellIndex = this.focusedCell.colIndex;
        rowIndex = this.focusedCell.rowIndex;
      }
    } else {
      $focusedCell = $(focusedCell).closest( 'tr.gGrid-row>td' );

      if ( this.checkTabbableItem( focusedCell ) ) {
        inputArray = [];
        nodelist = $focusedCell.get(0).childNodes;
        nodelist = _.reduce( nodelist, function( inputArray, node ) {
          if ( node.tagName === 'INPUT' ) {
            inputArray.push(node);
          }
          return inputArray;
        }, inputArray );

        if ( isSift ) {
          if ( nodelist[0] !== focusedCell ) {
            runNative = true;
          }
        } else {
          if ( nodelist[nodelist.length - 1] !== focusedCell ) {
            runNative = true;
          }
        }
      }

      if ( !runNative ) {
        $focusedRow = $focusedCell.closest( 'tr' );
        cellIndex = $focusedCell.get(0).cellIndex + this.startCol;
        rowIndex = $focusedRow.get(0).rowIndex - this.headNum + this.rowTop;
      }
    }

    return { row: rowIndex, col: cellIndex, runNative: runNative };
  },
  moveActionableItem: function(e) {
    var isSift = e.shiftKey,
        position = this.getActivatePosition( isSift ),
//        frozenColumn = this.viewModel.getOption("frozenColumn"),
        displayType,
        that = this;

    if ( !position.runNative ) {
      if ( position.row !== null ) {
        displayType = this.viewModel.getMeta( [position.row, position.col], 'displayType' );
        if ( displayType === 'text' ) {
          if ( this.$editBox.data( "edit" ) ) {
            cellObjects["text"].endEdit.call( cellObjects["text"], e, that, { isForced: true } );
          }
        }

        if ( isSift ) {
          if ( position.col === 0 ) {
            if ( position.row > 0 ) {
              position.col = this.viewModel.getVisibleCol().length - 1;

              if ( position.col >= this.endCol ) {
                this.moveRight( e, { targetCol: position.col, isForced: true } );
                this.moveUp( e, { isForced: true } );
              }
            } else {
              e.preventDefault();
              return false;
            }
          } else {
            this.moveLeft( e, { isForced: true } );
          }
        } else {
          if ( position.col === this.viewModel.getVisibleCol().length - 1 ) {
            if ( position.row < this.getRowLength() - 1 ) {
              position.col = 0;

              if ( position.col <= this.startCol ) {
                this.moveLeft( e, { targetCol: position.col, isForced: true } );
                this.moveDown( e, { isForced: true } );
              }
            } else {
              e.preventDefault();
              return false;
            }
          } else {
            this.moveRight( e, { isForced: true } );
          }
        }

        this.focusWidget( e );
      }
    }
  },
  jumpTo: function( e ) {
    if ( e.keyCode === this.keySet["HOME"] ) {
      this.moveLeft( e, { targetCol: 0, isForced: true } );
    } else if ( e.keyCode === this.keySet["END"] ) {
      this.moveRight( e, { targetCol: this.viewModel.getVisibleCol().length - 1, isForced: true } );
    } else if ( e.keyCode === this.keySet["PageUP"] ) {
      this.moveUp( e, { targetRow: 0, isForced: true } );
    } else if ( e.keyCode === this.keySet["PageDOWN"] ) {
      this.moveDown( e, { targetRow: this.getRowLength() - 1, isForced: true } );
    }
  },
  delegateGridEvents: function( action ) {
    var key,
        args = [].slice.call( arguments, 1 );

    if ( typeof args[0] === 'object' ) {
      for ( key in args[0] ) {
        if ( _.isString( args[0][key] ) ) {
          args[0][key] = this.options[args[0][key]];
        }
      }
    } else if (  _.isString( args[1] ) ) {
      args[1] = this.options[args[1]];
    }

    if ( action.search( /[l|L]isten/ ) !== -1 ) {
      args.unshift( args.pop() );
    }
    BView[action].apply( this, args );
  },
  on: function( event, callback, context ) {
    this.delegateGridEvents( 'on', event, callback, context );
  },
  off: function( event, callback, context ) {
    this.delegateGridEvents( 'off', event, callback, context );
  },
  once: function( event, callback, context ) {
    this.delegateGridEvents( 'once', event, callback, context );
  },
  listenTo: function( other, event, callback ) {
    this.delegateGridEvents( 'listenTo', event, callback, other );
  },
  stopListening: function( other, event, callback ) {
    this.delegateGridEvents( 'stopListening', event, callback, other );
  },
  listenToOnce: function( other, event, callback ) {
    this.delegateGridEvents( 'listenToOnce', event, callback, other );
  }
};

function GridSelector(grid, items) {
  return new GridSelector.fn.init(grid, items);
}

GridSelector.fn = GridSelector.prototype = {
  constructor : GridSelector,
  init : function (grid, items) {
    this.grid = grid;
    this.viewModel = grid.viewModel;
    this.push.apply(this, items);
  },
  clone : function (grid) {
    this.grid = grid; 
  },
  length : 0,
  push : [].push,
  slice : [].slice,
  splice : [].splice,
  sort : [].sort
};

GridSelector.fn.init.prototype = GridSelector.fn;
GridSelector.fn.clone.prototype = GridSelector.fn;

var GridSelectorApis = {
  get: function (prop) {
    var args = [].slice.call( arguments, 1 ),
        result = _(this).map( function(pos) {
          if ( prop === "data" ) {
            return this.viewModel.getData.apply( this.viewModel, [pos].concat( args ) );
          } else if ( prop === "option" ) {
            return this.viewModel.getOption.apply( this.viewModel, args );
          } else {
            var deep = _.isString( args[0] ),
                ret = this.viewModel.getMeta.apply( this.viewModel, [pos, prop, deep ? args[1] : args[0]] );

            if ( deep ) {
              ret = ret[args[0]];
            }
            return ret;
          }
        }, this);
    return this.length > 1 ? result : result[0];
  },
  set: function (prop) {
    var args = [].slice.call(arguments, 1);
    _(this).each(function(pos) {
      if(prop === "data") {
        this.viewModel.setData.apply(this.viewModel, [pos].concat(args));
      } else if(prop === "option") {
        this.viewModel.setOption.apply(this.viewModel, args);
      } else {
        var deep = _.isString(args[1]), value;
        if(deep) {
          value = _.clone(this.viewModel.getMeta(pos, prop, {noncomputed:true})) || {};
          value[args[0]] = args[1];
          this.viewModel.setMeta.apply(this.viewModel, [pos, prop, value, args[2]]);
        } else {
          this.viewModel.setMeta.apply(this.viewModel, [pos, prop, args[0], args[1]]);
        }
      }
    }, this);
    return this;
  },
  alter: function (prop, value1, value2) {
    var args = arguments;
    _(this).each(function(pos) {
      if( args.length === 2 ) {
        this.viewModel.setMeta(pos, prop, value1, {alter:true});
      } else {
        var tmpMeta = _.clone(this.viewModel.getMeta(pos, prop)) || {};
        tmpMeta[value1] = value2;
        this.viewModel.setMeta(pos, prop, tmpMeta, {alter:true});
      }
    }, this);
    return this;
  },
  has: function (prop, prop2) {
    if(arguments.length === 1) {
      return this.viewModel.hasMeta(this[0], prop);
    } else {
      var tmpMeta = this.viewModel.getMeta(this[0], prop) || {};
      return tmpMeta.hasOwnProperty(prop2);
    }
  },
  unset: function(prop, prop2) {
    var args = arguments;
    _(this).each(function(pos) {
      if( args.length === 2 ) {
        this.viewModel.removeMeta(pos, prop);
      } else {
        var tmpMeta = _.clone(this.viewModel.getMeta(pos, prop)) || {};
        delete tmpMeta[prop2];
        this.viewModel.setMeta(pos, prop, tmpMeta);
      }
    }, this);
    return this;
  },
  addClass : function ( className ) {
    var tmpMeta, classNameArr;
    classNameArr = className === '' ? [] : className.split(/\s/);

    _(this).each( function ( pos ) {
      tmpMeta = this.viewModel.getMeta( pos, "className", {noncomputed:true} );
      tmpMeta = tmpMeta === '' ? [] : tmpMeta.split(/\s/);

      _(classNameArr).each(function(index) {
        tmpMeta.push(index);
      });
      this.viewModel.setMeta( pos, "className", tmpMeta.join(" ") );
    }, this );

    return this;
  },
  hasClass : function(className){
    var tmpStr = this.viewModel.getMeta(this[0], "className", {noncomputed:true}),
        hasFlag = false;

    _(tmpStr.split(/\s+/)).each(function(item){
      if ( item===className ){
        hasFlag = true; 
      }
    });

    return hasFlag;
  },
  removeClass : function(className){
    var tmpStr = this.viewModel.getMeta(this[0], "className", {noncomputed:true});

    if ( tmpStr.length!==0 ){
      _(this).each(function(pos) {
        this.viewModel.setMeta( pos, "className",
          _(tmpStr.split(/\s+/)).difference(className.split(/\s+/)).join(" ") );
      }, this);
    }

    return this;
  },
  toggleClass: function(className, addOrRemove){
    var tmpStr = this.viewModel.getMeta(this[0], "className", {noncomputed:true}),
        targetIdx;

    if(arguments.length === 1) {
      _(tmpStr.split(/\s+/)).each(function(item, i){
        if ( item===className ){ 
          targetIdx = i;
        }
      });
    
      addOrRemove = _.isUndefined(targetIdx) ? true : false;
    }

    if ( addOrRemove ) {
      this.addClass(className);
    } else {
      this.removeClass(className);
    }
    
    return this;
  },
  triggerGridEvent: function ( event, options ) {
    _(this).each( function ( pos ) {
      this.grid.triggerGridEvent( pos, event, options );
    }, this );
    return this;
  }
};

var cellProto = {
  alterValue : function(grid, dom, value) {
    dom.firstChild.value = value;
  },
  dblclick: function ( e, grid ) {
    grid.focusWidget( e );
  },
  setOptions: function( options, index, value, label, isNew ) {
    if ( isNew ) {
      options.index = index;
      options.value = value;
      options.label = label;
    } else {
      options.oldIndex = index;
      options.oldValue = value;
      options.oldLabel = label;
    }
    return options;
  },
  getFormattedData: function( data, row, col, grid, options ) {
    var format = grid.viewModel.getMeta( [row, col], "format" ) || "";

    format = options && options.format ? options.format : format;

    return _.isFunction(format) ? format.call( grid, data ) : w5.formatter( data, format,
      grid.viewModel.getMeta( [row, col], "dataType" ), {
        originalFormat: grid.viewModel.getMeta( [row, col], "originalFormat" ) || "",
        dayInWeek: grid.viewModel.getOption('dayInWeek') || w5.formatter.defaultDayInWeek,
        APM: grid.viewModel.getOption('APM') || w5.formatter.defaultAPM
      } );
  }
}, cellObjects = {};

cellObjects["text"] = _.defaults({
  getContent : function(grid, data, row, col) {
    var template = grid.viewModel.getMeta( [row, col], "template") || "<%=data%>";

    if ( _.isString(template) ) {
      template = _.template(template);
    }

    return template( { data: this.getFormattedData( data, row, col, grid ) } );
  },
  dblclick: function(e, grid, row, col) {
    var readOnly = grid.viewModel.getMeta( [row, col], "readOnly");

    if( !readOnly ) {
      this.popupEditBox(grid, row, col);
    }
    $("body").addClass("noselect");
  },
  popupEditBox: function(grid, row, col) {
    var frozenColumn = grid.viewModel.getOption("frozenColumn"),
        tdCol = col < frozenColumn ? col : col-grid.startCol+frozenColumn,
        $cell = $(grid.getTbodyCell(row - grid.rowTop, tdCol)),
        data = grid.viewModel.getData([row, col]);

    grid.$editBox.text(data).css({
      width: "auto",
      "min-width": $cell.outerWidth(),
      height: $cell.outerHeight(),
      top: $cell.offset().top - grid.$wrapper_div.offset().top,
      left: $cell.offset().left - grid.$wrapper_div.offset().left
    }).data({
      edit : true,
      row : row,
      col : col,
      grid : grid,
      dataType: _.isDate(data) ? 'date' : _.isNumber(data) ? 'number' : _.isBoolean(data) ? 'boolean' : null
    });
    grid.$editBox.focus();

    if (typeof window.getSelection !== "undefined" &&
        typeof document.createRange !== "undefined") {
      var range = document.createRange();
      range.selectNodeContents( grid.$editBox[0] );
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (typeof document.body.createTextRange !== "undefined") {
      var textRange = document.body.createTextRange();
      textRange.moveToElementText( grid.$editBox[0] );
      textRange.collapse(false);
      textRange.select();
    }
  },
  endEdit: function( e, grid, options ) {
    if ( e.type === "blur" || ( e.type === "keydown" && e.keyCode === 13 ) || options.isForced ) {
      if ( grid.$editBox.data("edit") ) {
        var value = grid.$editBox.text(),
            row = grid.$editBox.data("row"),
            col = grid.$editBox.data("col"),
            dataType = grid.$editBox.data("dataType");

        grid.viewModel.setData( [row, col], ( dataType === 'date' ) ? new Date(value) : dataType ? w5.dataType[dataType](value) : value );
        grid.$editBox.text("").css("cssText", "");
        grid.$editBox.removeData("edit");
      }
    }
    $("body").removeClass("noselect");
  },
  completedOptions: function ( grid, result, rowIndex, colID, data, model ) {
    result.oldValue = model._previousAttributes[colID];
    result.value = data;
    return result;
  }
}, cellProto);
_(cellObjects["text"]).bindAll("dblclick", "popupEditBox", "endEdit");

cellObjects["select"] = _.defaults({
  getContent : function ( grid, value, row, col ) {
    var options = grid.viewModel.getMeta( [row, col], "options" ),
        $select,
        index = -1;

    $select = $( "<select>" + _(options).reduce( function( memo, obj, idx ) {
      if ( index === -1 && obj.value === value ) {
        index = idx;
      }
      var selected = ( (index > -1) && (obj.value === value) ) ? " selected": "";
      return memo + "<option " + selected + ">" + obj.label + "</option>";
    }, "" ) + "</select>");

    $select.prop( "selectedIndex", index );

    if ( index === -1 ) {
      $select.data( 'status', this.setOptions( {}, index, undefined, undefined, true ) );
      $select.data( "afterProcess", { run: function () {
        $select.prop( "selectedIndex", -1 );
        grid.viewModel.setData( [row, col], '', { silent: true } );
      } } );
    } else {
      $select.data( 'status', this.setOptions( {}, index, options[index].value, options[index].label, true ) );
    }

    $select.data( "pos", {
      row : row,
      col : col
    });

    $select.on( "change", function(e) {
      var idx = this.selectedIndex,
          $this = $(this),
          pos = $this.data("pos"),
          status = $this.data('status'),
          options = grid.viewModel.getMeta( [pos.row, pos.col], "options" ),
          value = options[idx] ? options[idx].value : undefined;

      status = cellObjects['select'].setOptions( status, status.index, status.value, status.label, false );
      status = cellObjects['select'].setOptions( status, idx, value, options[idx] ? options[idx].label : undefined, true );
      grid.viewModel.setData( [pos.row, pos.col], value, { noDraw: true, eventObj: e, status: status } );
    });
    return $select;
  },
  completedOptions: function ( grid, result, rowIndex, colID, data, model ) {
    var options = grid.viewModel.getMeta( [rowIndex, colID], 'options' ),
        cell,
        idx = -1,
        matchedItem;

    cell = grid.getTbodyCell( rowIndex, grid.viewModel.getColIndex(colID) );

    if ( cell ) {
      idx = cell.querySelector('select').selectedIndex;
      result = this.setOptions( result,
        idx,
        options[idx] ? options[idx].value : undefined,
        options[idx] ? options[idx].label : undefined,
        false );
    } else {
      result.oldValue = model._previousAttributes[colID];
      matchedItem = _(options).find( function( obj ) {
        idx += 1;
        if ( obj.value === result.oldValue ) {
          return obj;
        }
      });

      if ( matchedItem ) {
        result = this.setOptions( result, idx, result.oldValue, matchedItem.label, false );
      } else {
        result = this.setOptions( result, -1, undefined, undefined, false );
      }
    }

    idx = -1;
    matchedItem = _(options).find( function( obj ) {
      idx += 1;
      if ( obj.value === data ) {
        return obj;
      }
    });

    if ( matchedItem ) {
      result = this.setOptions( result, idx, data, matchedItem.label, true );
    } else {
      result = this.setOptions( result, -1, undefined, undefined, true );
    }

    return result;
  }
}, cellProto);

cellObjects["checkbox"] = _.defaults({
  getContent : function ( grid, value, row, col ) {
    var options = grid.viewModel.getMeta( [row, col], "options" ),
        values = grid.viewModel.checkNegativeValue( value ) ? [] : value.split(" "),
        indexes = [],
        labels = [],
        $checkbox = $( _(options).reduce( function ( memo, obj, idx ) {
          var checked = _(values).indexOf(obj.value) >= 0 ? " checked='true'" : "";

          if ( checked ) {
            indexes.push(idx);
            labels.push(obj.label);
          }

          return memo + "<input type='checkbox' id='checkbox_" + row + "_" + col + "_" + idx + "'" + checked + ">" +
              "<label for='checkbox_" + row + "_" + col + "_" + idx + "'>" + obj.label + "</label>";
        }, ""));

    $checkbox.data( 'status', this.setOptions( {}, indexes, values, labels, true ) );
    $checkbox.data( "pos", {
      row : row,
      col : col
    });

    $checkbox.on( "change", function(e) {
      var $this = $(this),
          $checkboxArr = $this.parent().find("input[type=checkbox]"),
          pos = $this.data("pos"),
          status = $this.data('status'),
          options = grid.viewModel.getMeta( [pos.row, pos.col], "options" ),
          indexes = [],
          labels = [],
          checked = $checkboxArr.map( function( index, dom ) {
            return $(dom).prop("checked");
          }),
          values = _.chain(options).map( function( obj, idx ) {
            if ( checked[idx] ) {
              indexes.push(idx);
              labels.push(obj.label);
              return obj.value;
            } else {
              return "";
            }

          }).compact().value();

      status = cellObjects['checkbox'].setOptions( status, status.index, status.value, status.label, false );
      status = cellObjects['checkbox'].setOptions( status, indexes, values, labels, true );
      grid.viewModel.setData( [pos.row, pos.col], values.join(" "), { noDraw: true, eventObj: e, status: status } );
    });
    return $checkbox;
  },
  fillOptions: function( options, values, result, flag ) {
    var indexes = [],
        labels = [];

    _(options).each( function ( obj, idx ) {
      if ( _(values).indexOf(obj.value) > -1 ) {
        indexes.push(idx);
        labels.push(obj.label);
      }
    } );
    return this.setOptions( result, indexes, values, labels, flag );
  },
  completedOptions: function ( grid, result, rowIndex, colID, data, model ) {
    var options = grid.viewModel.getMeta( [rowIndex, colID], 'options' );

    result = this.fillOptions( options, grid.viewModel.checkNegativeValue( model._previousAttributes[colID] ) ? [] : model._previousAttributes[colID].split(" "), result, false );
    result = this.fillOptions( options, grid.viewModel.checkNegativeValue( data ) ? [] : data.split(" "), result, true );

    return result;
  }
}, cellProto);

cellObjects["radio"] = _.defaults({
  getContent : function ( grid, value, row, col ) {
    var options = grid.viewModel.getMeta( [row, col], "options" ),
        cid = grid.viewModel.getDataCID(row),
        checked,
        index = -1,
        $radio = $( _(options).reduce( function ( memo, obj, idx ) {
          if ( value === obj.value ) {
            checked = " checked='true'";
            index = idx;
          } else {
            checked = "";
          }
          return memo + "<input type='radio' name='" + cid + "' id='radio_" + row + "_" + col + "_" + idx + "'" + checked+ ">" +
              "<label for='radio_" + row + "_" + col + "_" + idx + "'>" + obj.label + "</label>";
        }, ""));

    if ( index === -1 ) {
      $radio.data( 'status', this.setOptions( {}, index, undefined, undefined, true ) );
    } else {
      $radio.data( 'status', this.setOptions( {}, index, options[index].value, options[index].label, true ) );
    }
    $radio.data( "pos", {
      row : row,
      col : col
    });

    $radio.on( "change", function (e) {
      var $this = $(this),
          $radioArr = $this.parent().find("input[type=radio]"),
          pos = $this.data("pos"),
          status = $this.data('status'),
          options = grid.viewModel.getMeta( [pos.row, pos.col], "options" ),
          checked = $radioArr.map( function ( index, dom ) {
            return $(dom).prop("checked");
          }),
          index = _.indexOf( checked, true ),
          value,
          label;

      if ( index !== -1 ) {
        value = options[index].value;
        label = options[index].label;
      }

      status = cellObjects['radio'].setOptions( status, status.index, status.value, status.label, false );
      status = cellObjects['radio'].setOptions( status, index, value, label, true );
      grid.viewModel.setData( [pos.row, pos.col], value, { noDraw: true, eventObj: e, status: status });
    });
    return $radio;
  },
  fillOptions: function( options, value, result, flag ) {
    var index = -1,
        label;

    _(options).each( function ( obj, idx ) {
      if ( value === obj.value ) {
        index = idx;
        label = obj.label;
      }
    });
    return this.setOptions( result, index, value, label, flag );
  },
  completedOptions: function ( grid, result, rowIndex, colID, data, model ) {
    var options = grid.viewModel.getMeta( [rowIndex, colID], 'options' );

    result = this.fillOptions( options, model._previousAttributes[colID], result, false );
    result = this.fillOptions( options, data, result, true );

    return result;
  }
}, cellProto);

cellObjects["link"] = _.defaults({
  getContent : function ( grid, value ) {
    var href = value,
        label = value,
        target, title;

    if ( _.isObject(value) ){
      href = value.href;
      label = value.label;
      target = value.target ? " target='" + value.target + "' " : "";
      title = value.title ? " title='" + value.title + "' " : "";
    }

    return $("<a href='" + href + "'" + target + title + ">" + label + "</a>");
  }
}, cellProto);

cellObjects["img"] = _.defaults({
  getContent : function ( grid, value ) {
    var src = value, alt;

    if ( _.isObject(value) ){
      src = value.value;
      alt = value.alt ?  " alt='" + value.alt + "' " : "";
    }

    return $("<img src='" + src + "'" + alt + " tabindex=0 />");
  }
}, cellProto);

cellObjects["button"] = _.defaults({
  getContent : function ( grid, value ) {
    return $("<button>" + value + "</button>");
  }
}, cellProto);

cellObjects["toggleButton"] = _.defaults({
  click: function ( e, grid, row ) {
    var collapsed = !!grid.viewModel.getMeta([row, "*"], "collapsed");
    grid.clearFocusedCell();
    grid.viewModel.setMeta([row, "*"], "collapsed", !collapsed);
  },
  getContent : function ( grid, value, row ) {
    var collapsed = !!grid.viewModel.getMeta([row, "*"], "collapsed"),
        plusminus = collapsed ? "fold" : "unfold";

    value = value || grid.viewModel.getMeta([row, "*"], "group").join("-");
    return $("<i class='w5-grid-group "+ plusminus + "'>"+ plusminus +"</i><span class='w5-grid-group-text'>" + value + "</span>");
  },
  dblclick: function () {
    return false;
  }
}, cellProto);

cellObjects["custom"] = _.defaults( {
  getContent: function ( grid, data, row, col ) {
    var template = grid.viewModel.getMeta( [row, col], "template" ) || "<%=data%>",
        format = grid.viewModel.getMeta( [row, col], "format" ) || "";
    if ( _.isString( template ) ) {
      template = _.template( template );
    }
    return template( { data: _.isFunction(format) ? format.call( this, data ) : data } );
  }
}, cellProto );

var cellView = Backbone.View.extend( {
      initialize: function() {
      }
    } ),
    cellViews = {};

cellViews['checkbox'] = cellView.extend( {
  tagName: "input",
  attributes: { type: 'checkbox', style: 'margin-left: 10px' },
  initialize: function( $parentNode, grid, value, position, options ) {
    options = options || {};
    this.grid = grid;
    this.render( $parentNode, grid, value, position, options );
  },
  render: function( $parentNode, grid, value, position ) {
    this.$el.attr( 'id', 'header_checkbox_' + position[0] + '_' + position[1] );
    $parentNode.append( this.el );
    return this;
  },
  grid: null,
  events: {
    'click': 'toggleChoice'
  },
  toggleChoice: function(e) {
    var value = '',
        $th = $(e.target).closest("th"),
        tdCol = $th.index(),
        frozenColumn = this.grid.viewModel.getOption("frozenColumn"),
        colIndex = tdCol < frozenColumn ? tdCol : tdCol + this.grid.startCol - frozenColumn;

    if ( this.$el[0].checked ) {
      value = this.grid.viewModel.getCheckValue( { col: colIndex } );
    }
    this.grid.col(colIndex).set( 'data', value );
  }
} );

_(GridSelector.fn).extend(GridSelectorApis);

var Grid = Backbone.View.extend(GridProto);
var Model = Backbone.Model.extend( _.extend( {}, w5DataModelProto, w5DataModelProtoPro ) );
var Collection = Backbone.Collection.extend( _.extend( {model : Model}, w5DataCollectionProto, w5DataCollectionProtoPro ) );

w5.Model = Model;
w5.Collection = Collection;
w5.Grid = Grid;

w5.dataType = {
  "auto": function(value) { return value; },
  "string": String,
  "number": Number,
  "boolean": Boolean,
  "date": function(value) { return value; }
};

w5.formatter = function ( value ) {
  return value;
};
return w5;

}));
