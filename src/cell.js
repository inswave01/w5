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
