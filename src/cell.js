var cellProto = {
  alterValue : function(grid, dom, value) {
    dom.firstChild.value = value;
  }
}, cellObjects = {};

cellObjects["text"] = _.defaults({
  $editBox: $("<div class='w5_grid_editbox' contenteditable='true'>"),
  getContent : function(grid, data, row, col) {
    var template = grid.viewModel.getMeta([row, col], "template") || "<%=data%>",
        format = grid.viewModel.getMeta([row, col], "format") || "";
    if(_.isString(template)) {
      template = _.template(template);
    }
    return template({data:w5.numberFormatter(data, format)});
  },
  dblclick: function(e, grid, row, col) {
    var readOnly = grid.viewModel.getMeta( [row, col], "readOnly");
    if(!readOnly) {
      this.popupEditBox(grid, row, col);
    }
  },
  popupEditBox: function(grid, row, col) {
    var frozenColumn = grid.viewModel.getOption("frozenColumn"),
        tdCol = col < frozenColumn ? col : col-grid.startCol+frozenColumn,
        $cell = $(grid.getTbodyCell(row - grid.rowTop, tdCol)),
        data = grid.viewModel.getData([row, col]);
    grid.$el.append(this.$editBox);
    this.$editBox.text(data).css({
      width: "auto",
      "min-width": $cell.outerWidth(),
      height: $cell.outerHeight(),
      top: $cell.offset().top - grid.$el.offset().top,
      left: $cell.offset().left - grid.$el.offset().left
    }).show().data({
      row : row,
      col : col,
      grid : grid
    });
    this.$editBox.focus();

    if (typeof window.getSelection !== "undefined" &&
        typeof document.createRange !== "undefined") {
      var range = document.createRange();
      range.selectNodeContents( this.$editBox[0] );
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (typeof document.body.createTextRange !== "undefined") {
      var textRange = document.body.createTextRange();
      textRange.moveToElementText( this.$editBox[0] );
      textRange.collapse(false);
      textRange.select();
    }
  },
  endEdit: function(e) {
    if(e.type === "blur" || (e.type === "keydown" && e.keyCode === 13)) {
      var value = this.$editBox.text(),
          row = this.$editBox.data("row"),
          col = this.$editBox.data("col"),
          grid = this.$editBox.data("grid");
      grid.viewModel.setData([row, col], value);
      this.$editBox.hide();
    }
  }
}, cellProto);
_(cellObjects["text"]).bindAll("dblclick", "popupEditBox", "endEdit");
$(cellObjects["text"].$editBox).on("blur keydown", cellObjects["text"].endEdit);

cellObjects["select"] = _.defaults({
  getContent : function(grid, value, row, col) {
    var options = grid.viewModel.getMeta([row, col], "options"),
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
      grid.viewModel.setData([pos.row, pos.col], value);
    });
    return $select;
  }
}, cellProto);

cellObjects["checkbox"] = _.defaults({
  getContent : function(grid, value, row, col) {
    var options = grid.viewModel.getMeta([row, col], "options"),
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
    });
    return $checkbox;
  }
}, cellProto);

cellObjects["radio"] = _.defaults({
  getContent : function(grid, value, row, col) {
    var options = grid.viewModel.getMeta([row, col], "options"),
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
    });
    return $radio;
  }
}, cellProto);

cellObjects["link"] = _.defaults({
  getContent : function ( grid, value ) {
    var href = _.isObject(value) ? value.href : value,
        label = _.isObject(value) ? value.label : value;
    return $("<a href='" + href + "'>" + label + "</a>");
  }
}, cellProto);

cellObjects["img"] = _.defaults({
  getContent : function ( grid, value ) {
    return $("<img src='" + value + "'/>");
  }
}, cellProto);

cellObjects["button"] = _.defaults({
  getContent : function ( grid, value ) {
    return $("<button>" + value + "</button>");
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

    return $("<i class='w5-grid-group "+ plusminus + "'>"+ plusminus +"</i><span class='w5-grid-group-text'>" + value + "</span>");
  }
}, cellProto);