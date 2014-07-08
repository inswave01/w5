var cellProto = {
  alterValue : function(grid, dom, value) {
    dom.firstChild.value = value;
  }
}, cellObjects = {};

cellObjects["text"] = _.defaults({
  getContent : function(grid, data, row, col) {
    var template = grid.viewModel.getMeta([row, col], "template") || "<%=data%>",
        format = grid.viewModel.getMeta([row, col], "format") || "";
    if(_.isString(template)) {
      template = _.template(template);
    }
    return template( { data: _.isFunction(format) ? format.call( grid, data ) : w5.numberFormatter( data, format ) } );
  },
  dblclick: function(e, grid, row, col) {
    var readOnly = grid.viewModel.getMeta( [row, col], "readOnly");
    if(!readOnly) {
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
      dataType: _.isNumber(data) ? 'number' : _.isBoolean(data) ? 'boolean' : null
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

        grid.viewModel.setData([row, col], dataType ? w5.dataType[dataType](value) : value );
        grid.$editBox.text("").css("cssText", "");
        grid.$editBox.removeData("edit");
      }
    }
    $("body").removeClass("noselect");
  }
}, cellProto);
_(cellObjects["text"]).bindAll("dblclick", "popupEditBox", "endEdit");

cellObjects["select"] = _.defaults({
  getContent : function(grid, value, row, col) {
    var options = grid.viewModel.getMeta([row, col], "options"),
        callback = grid.viewModel.getMeta([row, col], "callback"),
        $select,
        index;
    $select = $("<select>" + _(options).reduce(function(memo, obj) {
      return memo + "<option>" + obj.label + "</option>";
    }, "") + "</select>");
    for(index = 0; index < options.length; index++) {
      if(options[index].value === value) {
        $select.val(options[index].label);
        break;
      }
    }
    $select.data("pos", {
      row : row,
      col : col
    });
    $select.on("change", function() {
      var $this = $(this),
          pos = $this.data("pos"),
          label = $this.val(),
          options = grid.viewModel.getMeta([pos.row, pos.col], "options"),
          value = _(options).findWhere({label:label}).value;
      grid.viewModel.setData([pos.row, pos.col], value, {silent: true});

      if ( callback && callback.change && _.isFunction( callback.change ) ) {
        callback.change.call( grid, value, pos );
      }
    });
    return $select;
  },
  dblclick: function(e, grid) {
    grid.focusWidget( e, { isSkip: true } );
  }
}, cellProto);

cellObjects["checkbox"] = _.defaults({
  getContent : function(grid, value, row, col) {
    var options = grid.viewModel.getMeta([row, col], "options"),
        callback = grid.viewModel.getMeta([row, col], "callback"),
        values = value.split(" "),
        $checkbox = $(_(options).reduce(function(memo, obj, idx) {
          var checked = _(values).indexOf(obj.value) >= 0 ? " checked='true'" : "";
          return memo + "<input type='checkbox' id='checkbox_" + row + "_" + col + "_" + idx + "'" + checked+ ">" +
              "<label for='checkbox_" + row + "_" + col + "_" + idx + "'>" + obj.label + "</label>";
        }, ""));
    $checkbox.data("pos", {
      row : row,
      col : col
    });
    $checkbox.on("change", function() {
      var $this = $(this),
          $checkboxArr = $this.parent().find("input[type=checkbox]"),
          pos = $this.data("pos"),
          options = grid.viewModel.getMeta([pos.row, pos.col], "options"),
          checked = $checkboxArr.map(function(index, dom) {
            return $(dom).prop("checked");
          }),
          value = _.chain(options).map(function(obj, idx) {
            return checked[idx] ? obj.value : "";
          }).compact().value().join(" ");
      grid.viewModel.setData([pos.row, pos.col], value, {silent:true});

      if ( callback && callback.change && _.isFunction( callback.change ) ) {
        callback.change.call( grid, value, pos );
      }
    });
    return $checkbox;
  },
  dblclick: function(e, grid) {
    grid.focusWidget( e, { isSkip: true } );
  }
}, cellProto);

cellObjects["radio"] = _.defaults({
  getContent : function(grid, value, row, col) {
    var options = grid.viewModel.getMeta([row, col], "options"),
        callback = grid.viewModel.getMeta([row, col], "callback"),
        values = value.split(" "),
        cid = grid.viewModel.getDataCID(row),
        $radio = $(_(options).reduce(function(memo, obj, idx) {
          var checked = _(values).indexOf(obj.value) >= 0 ? " checked='true'" : "";
          return memo + "<input type='radio' name='" + cid + "' id='radio_" + row + "_" + col + "_" + idx + "'" + checked+ ">" +
              "<label for='radio_" + row + "_" + col + "_" + idx + "'>" + obj.label + "</label>";
        }, ""));
    $radio.data("pos", {
      row : row,
      col : col
    });
    $radio.on("change", function() {
      var $this = $(this),
          $radioArr = $this.parent().find("input[type=radio]"),
          pos = $this.data("pos"),
          options = grid.viewModel.getMeta([pos.row, pos.col], "options"),
          checked = $radioArr.map(function(index, dom) {
            return $(dom).prop("checked");
          }),
          item = options[_.indexOf(checked, true)],
          value = item ? item.value : undefined;
      grid.viewModel.setData([pos.row, pos.col], value, {silent:true});

      if ( callback && callback.change && _.isFunction( callback.change ) ) {
        callback.change.call( grid, value, pos );
      }
    });
    return $radio;
  },
  dblclick: function(e, grid) {
    grid.focusWidget( e, { isSkip: true } );
  }
}, cellProto);

cellObjects["link"] = _.defaults({
  getContent : function ( grid, value ) {
    var href = _.isObject(value) ? value.href : value,
        label = _.isObject(value) ? value.label : value;
    return $("<a href='" + href + "'>" + label + "</a>");
  },
  dblclick: function(e, grid) {
    grid.focusWidget( e, { isSkip: true } );
  }
}, cellProto);

cellObjects["img"] = _.defaults({
  getContent : function ( grid, value ) {
    return $("<img src='" + value + "' tabindex=0 />");
  }
}, cellProto);

cellObjects["button"] = _.defaults({
  getContent : function ( grid, value ) {
    return $("<button>" + value + "</button>");
  },
  dblclick: function(e, grid) {
    grid.focusWidget( e, { isSkip: true } );
  }
}, cellProto);

cellObjects["toggleButton"] = _.defaults({
  click: function ( e, grid, row ) {
    var closed = !!grid.viewModel.getMeta([row, "*"], "closed");
    grid.viewModel.setMeta([row, "*"], "closed", !closed);
  },
  getContent : function ( grid, value, row ) {
    var closed = !!grid.viewModel.getMeta([row, "*"], "closed"),
        plusminus = closed ? "fold" : "unfold";

    value = value || grid.viewModel.getMeta([row, "*"], "group").join("-");
    return $("<i class='w5-grid-group "+ plusminus + "'>"+ plusminus +"</i><span class='w5-grid-group-text'>" + value + "</span>");
  }
}, cellProto);

cellObjects["custom"] = _.defaults( {
  getContent: function ( grid, data, row, col ) {
    var template = grid.viewModel.getMeta( [row, col], "template" ) || "<%=data%>",
        format = grid.viewModel.getMeta( [row, col], "format" ) || "";
    if ( _.isString( template ) ) {
      template = _.template( template );
    }
    return template( { data: _.isFunction(format) ? format.call( this, data ) : w5.numberFormatter( data, format ) } );
  },
  dblclick: function(e, grid) {
    grid.focusWidget( e, { isSkip: true } );
  }
}, cellProto );
