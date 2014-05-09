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
    var args = [].slice.call(arguments, 1);
    if(prop === "data") {
      return this.viewModel.getData.apply(this.viewModel, [this[0]].concat(args));
    } else if(prop === "option") {
      return this.viewModel.getOption.apply(this.viewModel, args);
    } else {
      var deep = _.isString(args[0]), ret;
      ret = this.viewModel.getMeta.apply(this.viewModel, [this[0], prop, deep ? args[1] : args[0]]);
      if( deep ) {
        ret = ret[arguments[1]];
      }
      return ret;
    }
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
      if(prop === "data") {
        this.viewModel._setData.apply(this.bobj, [pos].concat([].slice.call(args, 1)));
      } else {
        if( args.length === 2 ) {
          this.viewModel.setMeta(pos, prop, value1, {alter:true});
        } else {
          var tmpMeta = _.clone(this.viewModel.getMeta(pos, prop)) || {};
          tmpMeta[value1] = value2;
          this.viewModel.setMeta(pos, prop, tmpMeta, {alter:true});
        }
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
    } , this);
    return this;
  },
  addClass : function(className){ 
    var tmpStr = this.viewModel.getMeta(this[0], "class", {noncomputed:true});

    if ( tmpStr.length===0 ){
      this.viewModel.setMeta(this[0], "class", className);
    } else {
      this.viewModel.setMeta(this[0], "class", tmpStr+" "+className);
    }
    return this;
  },
  hasClass : function(className){
    var tmpStr = this.viewModel.getMeta(this[0], "class", {noncomputed:true}),
        hasFlag = false;

    _(tmpStr.split(/\s+/)).each(function(item){
      if ( item===className ){
        hasFlag = true; 
      }
    });

    return hasFlag;
  },
  removeClass : function(className){
    var tmpStr = this.viewModel.getMeta(this[0], "class", {noncomputed:true});

    if ( tmpStr.length!==0 ){
        this.viewModel.setMeta(this[0], "class",
          _(tmpStr.split(/\s+/)).difference(className.split(/\s+/)).join(" "));   
    }

    return this;
  },
  toggleClass: function(className, addOrRemove){
    var tmpStr = this.viewModel.getMeta(this[0], "class", {noncomputed:true}),
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
  }
};
