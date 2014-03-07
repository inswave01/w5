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
    grouped: true,
    groupRowCIDs: []
  };

  _(colModel).each( function ( model, index ) {
    var id = model.id || model.headerLabel;
    if(!id) {
      throw {
        name: "PrerequisiteError",
        message: "The column should be assigned one of id or headerLable."
      };
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
    //editType : null,
    class : ""
  },
  metaDataTypes: {
    style : "object",
    option : "object",
    class : "className",
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
        rst;

    options = options || {};
    if ( this.collection.__validator && _.isUndefined(options.validate) ) {
      options.validate = true;
    }
    pos[1] = this.getColID(pos[1], options.inorder );

    if ( pos[0] === "*" && pos[1] === "*" ) {
      models = this.collection.reset(value, options);
    } else if ( pos[1] === "*" ) {
      value = this.checkDataType( value );
      models = this.collection.at(pos[0]).set( value, options );
    } else if ( pos[0] === "*" ) {
      options.silent = true;
      options.save = false;
      options.targetColumn = pos[1];
      (this.collection).find( function( row, index ) {
        if ( _(value).isArray() && index >= value.length ) {
          return;
        }
        if ( value.length === (index + 1) ) {
          delete options.silent;
        }
        rst = row.set( pos[1], _(value).isArray() ? value[index] : value, options );

        return rst === false;
      }, this);
    } else {
      models = this.collection.at(pos[0]).set( pos[1], value, options );
    }

    if ( options.save === true ) {
      this.save( models, options );
    }
  },
  getCellData: function(rowIndex, colId) {
    var expression = this.getMeta([rowIndex, colId], "expression");
    if(_.isFunction(expression)) {
      return expression.call(this.view, {
        rowIndex: rowIndex,
        colId: colId,
        attributes: this.collection.at(rowIndex).toJSON()
      });
    } else {
      return this.collection.at(rowIndex).get(colId);
    }
  },
  getData: function ( pos, options ) {
    options = options || {};
    var isArray = options.type && options.type.toLowerCase() === 'array',
        singular, models, ret;

    pos[1] = this.getColID(pos[1], options.inorder);
    if ( pos[1] === "*" ) {
      singular = pos[0] !== "*";
      models = singular ? [this.collection.at(pos[0])] : this.collection.models;
      ret = _.map(models, function (model) {
        var keys, values;
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
          return this.getCellData(model.collection.indexOf(model), col);
        }, this);
        if ( !isArray ) {
          return _.object(keys, values);
        }
        return values;
      }, this );
      if(singular) {
        return ret[0];
      }
      return ret;
    } else if ( pos[0] === "*" ) {
      return this.collection.map(function (row, rowIndex) {
        return this.getCellData(rowIndex, pos[1]);
      }, this);
    }
    return this.getCellData(pos[0], pos[1]);
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
    obj.value = value;

    model.set( prop, prop === 'id' ? value : obj, options); 
  },
  getMeta: function ( pos, prop, options ) {
    options = options || {};
    pos[0] = this.getDataCID(pos[0]);
    pos[1] = this.getColID(pos[1], options.inorder);
    var model = this.getModel(pos[0], pos[1]),
        ret,
        metaArr;

    if ( (pos[0] === "*" || pos[1] === "*") || options.noncomputed ) {
      if(model && model.has(prop)) {
        ret = model.get(prop).value;
      } else {
        ret = this.metaDefaultObject[prop];
      }
    } else {
      metaArr = _([
        model,
        this.getModel("*", pos[1]),
        this.getModel(pos[0], "*"),
        this.getModel("*", "*")
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
    pos[1] = this.getColID(pos[1], options.inorder);
    var model = this.getModel(this.getDataCID(pos[0]), pos[1]);

    if ( model ) {
      model.unset(prop, options);
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
    var models;

    options = options || {};

    if ( arguments.length === 0 ) {
      data = {};
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
      models = this.collection.unshift( data );
    } else {
      if ( index ) {
        options.at = index;
      }
      models = this.collection.add( data, options );
    }

    if ( _.isArray( models ) ) {
      _.each( models, function( element ) {
        element.__isNew = true;
      });
    } else {
      models.__isNew = true;
    }

    if ( options.save === true ) {
      this.save( models, options );
    }
  },
  removeRow: function ( index, options ) {
    var targetRow;

    options = options || {};

    if(_.isNumber(index)) {
      targetRow = this.collection.at(index);
      this.removeMetaByDataCID( targetRow.cid );
    } else if(_.isString(index)) {
      targetRow = this.collection.get(index);
      this.removeMetaByDataCID( index );
    }
    if ( targetRow ) {
      if ( options.destroy ) {
        options.url = _.result( targetRow, 'url' );
      }

      targetRow = this.collection.remove( targetRow );
      if ( _.isArray( targetRow ) ) {
        targetRow = _.reduce( targetRow, function( memo, element ) {
          if ( !element.__isNew ) {
            memo.push(element);
          }
          return memo;
        }, [] );
        Array.prototype.push.apply( this.collection.__removeModels, targetRow );
      } else {
        if ( !targetRow.__isNew ) {
          this.collection.__removeModels.push(targetRow);
        }
      }

      if ( options.destroy ) {
        this.destroy( targetRow, options );
      }
    }
  },
  sort: function ( columns, directions ) {
    if ( _.isUndefined(columns) ) {
      this.collection.sortInfo.column = [];
    } else if ( _.isFunction(columns) ) {
      this.collection.sortInfo.column = columns;
    } else {
      if ( _.isNumber( columns ) || _.isString( columns ) ) {
        columns = [columns];
      }
      columns = _.map( columns, function (item) {
        return this.getColID(item);
      }, this );
      this.collection.sortInfo.column = columns;
    }

    if ( _.isUndefined(directions) ) {
      this.collection.sortInfo.direction = ['asc'];
    } else {
      if ( _.isString( directions ) ) {
        directions = [directions];
      }
      this.collection.sortInfo.direction = directions;
    }

    this.collection.sortData();
  },
  fetch: function( model, options ) {
    if ( _.isUndefined(model) ) {
      model = this.collection;
    } else if ( type.isNumber( model ) ) {
      model = this.collection.at(model);
    }
    model.fetch( options );
  },
  save: function ( models, options ) {
    var idx,
        data,
        success = options.success;

    options = options || {};
    if ( !_.isArray (models) ) {
      idx = this.collection.indexOf(models);
      if ( options.pick || options.omit ) {
        data = this.getData( [idx, '*'], options );
        options.patch = true;
      } else {
        data = null;
      }

      options.success = function ( modelCompleted, resp ) {
        models.__isNew = false;

        if ( success ) {
          success( modelCompleted, resp, options );
        }
      };

      this.collection.at( idx ).save( data, options );
    }
  },
  destroy: function ( models, options ) {
    var vModel = this,
        success = options.success;

    if ( !_.isArray ( models ) ) {
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

      models.destroy( options );
    }
  },
  getCUData: function ( options ) {
    var models = { create: [], update: [], delete: [] },
        excludeCreate = options.excludeCreate || false,
        excludeUpdate = options.excludeUpdate || false,
        excludeDelete = options.excludeDelete || false;

    if ( !excludeCreate || !excludeUpdate ) {
      models = _.reduce( this.collection.models, function ( store, model, idx ) {
        if ( !excludeCreate && model.__isNew ) {
          model.__idx = idx;
          store.create.push(model);
        } else if ( !excludeUpdate && model.hasChanged() ) {
          model.__idx = idx;
          store.update.push(model);
        }
        return store;
      }, models, this );
    }
    if ( !excludeDelete ) {
      Array.prototype.push.apply( models.delete, this.collection.__removeModels );
    }

    return models;
  },
  syncData: function ( options ) {
    var vModel = this,
        data = this.getCUData( options || ( options = {} ) ),
        dataCreated = data.create.slice(),
        dummy = _.extend( {}, Backbone.Events, {
          url: this.collection.urlCUD,
          getJSON: function (target) {
            _.each( target, function( ele, idx, list ) {
              list[idx] = this.getData( [ele.__idx, '*'], options );
              delete ele.__idx;
            }, vModel );
          },
          toJSON: function () {
            this.getJSON( data.create );
            this.getJSON( data.update );
            return data;
          }
        } ),
        success = options.success,
        grid = this;

    options.success = function ( model, resp ) {
      grid.collection.__removeModels = [];

      _.each( dataCreated, function ( item, idx ) {
        item.__isNew = false;
        if ( options.afterProcess && model.create && model.create[idx] ) {
          item.set( model.create[idx] );
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
        return _.object(this.collection.keys, data);
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
  }
};

var w5DataCollectionProto = {
  __validator: null,
  __invalidCallback: null,
  __sorting: false,
  __filtering: false,
  __originalCollection: null,
  __sortingCollection: null,
  __filteringCollection: null,
  defaults: null,
  initialize: function(models, options) {
    if(options) {
      this.grid = options.grid;
      this.keys = options.keys;
      this.url = options.url;
      this.urlCUD = options.urlCUD;
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
  cloneCollection: function (action) {
    if ( action === 'filter' && this.__sorting ) {
      this.__sortingCollection = this.clone();
      this.__sortingCollection.listenTo( this, 'add remove', this.syncData );
    } else if ( action === 'sort' && this.__filtering ) {
      this.__filteringCollection = this.clone();
      this.__filteringCollection.listenTo( this, 'add remove', this.syncData );
    } else if ( !this.__sorting && !this.__filtering ) {
      this.__originalCollection = this.clone();
      this.__originalCollection.listenTo( this, 'add remove', this.syncData );
    }
  },
  resetCollection: function () {
    if ( this.__sortingCollection ) {
      if( this.__filtering ) {
        this.reset( this.__originalCollection.models );
      } else {
        this.reset( this.__sortingCollection.models );
      }
      if ( !this.__sorting ) {
        this.__sortingCollection.stopListening( this, 'add remove', this.syncData );
        this.__sortingCollection = null;
      }
    }
    if ( this.__filteringCollection ) {
      if( this.__sorting ) {
        this.reset( this.__originalCollection.models );
      } else {
        this.reset( this.__filteringCollection.models );
      }
      if ( !this.__filtering ) {
        this.__filteringCollection.stopListening( this, 'add remove', this.syncData );
        this.__filteringCollection = null;
      }
    }
    if ( !this.__sorting && !this.__filtering && this.__originalCollection ) {
      this.reset( this.__originalCollection.models );
      this.__originalCollection.stopListening( this, 'add remove', this.syncData );
      this.__originalCollection = null;
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
        var collection1 = item1.collection.__originalCollection || item1.collection,
            collection2 = item2.collection.__originalCollection || item2.collection,
            idx1 = collection1.indexOf(item1),
            idx2 = collection2.indexOf(item2);
        return idx1 > idx2 ? 1 : -1;
      }

      if ( ( dirs[_.indexOf( cols, col )] || 'asc' ).toLowerCase() === 'asc' ) {
        return item1.attributes[col] > item2.attributes[col] ? 1 : -1;
      } else {
        return item1.attributes[col] < item2.attributes[col] ? 1 : -1;
      }
    }
  },
  sortData: function() {
    if ( this.sortInfo.column.length > 0 ) {
      this.cloneCollection('sort');
      this.__sorting = true;

      if ( _.isFunction(this.sortInfo.column) ) {
        this.comparator = this.sortInfo.column;
      } else {
        this.comparator = this.sortInfo.comparator;
      }

      this.sort();
    } else {
      if ( this.__sorting ) {
        this.__sorting = false;
        this.comparator = null;
        this.resetCollection();
      }
    }
  }
};

var w5DataModelProtoPro = null,
    w5DataCollectionProtoPro = null;
