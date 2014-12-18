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
