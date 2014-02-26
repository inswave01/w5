_(GridSelector.fn).extend(GridSelectorApis);

var Grid = Backbone.View.extend(GridProto);
var Model = Backbone.Model.extend( _.extend( {}, w5DataModelProto, w5DataModelProtoPro ) );
var Collection = Backbone.Collection.extend( _.extend( {model : Model}, w5DataCollectionProto, w5DataCollectionProtoPro ) );

window["w5"] = {
  Model: Model,
  Collection: Collection,
  Grid: Grid
};