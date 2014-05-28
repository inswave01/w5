var GridProto = {
  template: _.template(
    "<<%= tagName %> id='<%= id %>' class='gGrid<%= className %>' style='width:<%= width %>'>" +
      "<div class='gGrid-setTable'>" +
        "<table class='gGrid-table' style='width:0'>" +
          "<caption class='gGrid-caption'><%= caption %></caption>" +
          "<colgroup></colgroup>" +
          "<thead></thead>" +
          "<tbody></tbody>" +
        "</table>" +
        "<div class='adjustCol-handle-hover hide'></div>" +
        "<div class='separateCol hide'></div>" +
        "<div class='frozenCol hide'></div>" +
        "<div class='columnMove-indicator hide'></div>" +
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
    "dblclick .gGrid-table thead" : function(e) { this.sortColumn.dblClickEvent.call( this, e ); },
    "mousedown .gGrid-table thead" : function(e){ this.columnMove.downEvent.call( this, e ); },
    "click .gGrid-table tbody" : function(e){ this.clickCell.clickEvent.call( this, e ); },
    "dblclick .gGrid-table tbody" : function(e){ this.clickCell.clickEvent.call( this, e ); },
    "mousedown .frozenCol" : function(e){ this.frozenColumn.downEvent.call( this, e ); },
    "mousedown .gScroll-v" : function(e) { this.verticalScroll.areaDownEvent.call( this, e ); },
    "mousedown .gScroll-v .scrollHandler" : function(e) { this.verticalScroll.handleDownEvent.call( this, e ); },
    "mousedown .gScroll-h" : function(e) { this.horizontalScroll.areaDownEvent.call( this, e ); },
    "mousedown .gScroll-h .scrollHandler" : function(e) { this.horizontalScroll.handleDownEvent.call( this, e ); },
    "mousewheel" : function(e) { this.scrollByWheel.wheelEvent.call( this, e ); }
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
        defaults = options.defaults || _.object(keys, _.pluck(options.colModel, "default"));
    if( !this.id && this.$el && this.$el.attr("id") ) {
      this.id = this.$el.attr("id");
    }
    if( options.collection instanceof Collection ) {
      this.collection.grid = this;
      this.collection.keys = options.collection.keys ? options.collection.keys : keys;
      this.collection.defaults = options.collection.defaults ? options.collection.defaults : defaults;
    } else {
      this.collection = new Collection(options.collection, {
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
      this.viewModel.fetch( this.collection, _.extend( { reset: true, silent: true }, options.fetch ) );
    }

    this.listenTo( this.collection, 'change', this.onModelChange );
    this.listenTo( this.collection, 'add remove', this.onModelAddRemove );
    this.listenTo( this.collection, 'reset sort', this.onReset );
    this.listenTo( this.collection, 'sync', this.drawWhole );
    this.listenTo( this.viewModel.table, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.column, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.row, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.cell, 'change', this.drawMetaByPos );
    this.listenTo( this.viewModel.option, 'change', this.onOptionChange );
    
    var events = {},
        i;
    for(i in options.gridEvents) {
      var eventName = i.split(" ")[0];
      if(!events[eventName]) {
        events[eventName] = [];
      }
      events[eventName].push({
        select: i.slice(eventName.length + 1),
        funcName: options.gridEvents[i]
      });
    }
    this.gridEventMatch = events;
    for(i in events) {
      this.events[i + " td"] = "handleCommonEvent";
    }
    this.delegateEvents(this.events);
  },
  render: function() {
    var $el,
        $wrapper_div;

    this.viewModel.updateVisibleCol();

    $el = $(this.template({
      tagName: this.tagName || "div",
      id: this.id,
      className: " " + ( this.className || "" ),
      width: this.viewModel.getOption("width"),
      caption : this.viewModel.getOption("caption")
    }));

    this.$el.replaceWith( $el );
    this.$el = $el;
    $wrapper_div = $el.find(".gGrid-setTable");
    this.$wrapper_div = $wrapper_div;

    this.tableWidth = $wrapper_div.width();
    this.wholeTblWidth = this.getWholeTblWidth();

    // scroll value
    this.rowTop = 0;
    this.rowNum = $el.find("tbody tr").length;
    this.startCol = 0;
    this.endCol = $el.find("colgroup col").length;

    this.$scrollYArea   = $el.find(".gScroll-v");
    this.$scrollYHandle = $el.find(".gScroll-v .scrollHandler");
    this.$scrollXArea   = $el.find(".gScroll-h");
    this.$scrollXHandle = $el.find(".gScroll-h .scrollHandler");

    this.addEvents();
    this.setResize();

    return this; // enable chained calls
  },
  handleCommonEvent: function(e) {
    var events = this.gridEventMatch[e.type],
        $td = $(e.target).closest("td"),
        col = $td.index(),
        row = $td.parent().index() + this.rowTop,
        cid = this.viewModel.getDataCID(row),
        frozenColumn = this.viewModel.getOption("frozenColumn"),
        i, j, elems;
    if(col >= frozenColumn) {
      col += this.startCol;
    }
    col = this.viewModel.getColID(col, true); 
    for(i = 0; i < events.length; i++) {
      elems = this.select(events[i].select);
      for(j = 0; j < elems.length; j++) {
        if(elems[j][0] === cid && elems[j][1] === col) {
          this.options[events[i].funcName].call(this, e, row, col);
        }
      }
    }
  },
  parseTable: function(options) {
    if ( this.$el[0].tagName !== "TABLE" ) {
      return;
    }

    var $trs = this.$el.find("tr"),
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
    var $tbody = this.$el.find("tbody"),
        $colgroup = this.$el.find("colgroup"),
        rowNum = this.viewModel.getOption("rowNum"),
        visibleCol = this.viewModel.getVisibleCol(),
        widthSum = 0,
        colgroup = "",
        i, j, $tr, colNum;

    this.$el.find("tr").remove();

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
    this.delegateEvents();

    resizeChecker.add(this);
  },
  sortColumn: {
    dblClickEvent : function(e) {
      var $th = $(e.target).closest("th"),
          tdCol = $th.index(),
          frozenColumn = this.viewModel.getOption("frozenColumn"),
          col = tdCol < frozenColumn ? tdCol : tdCol + this.startCol - frozenColumn;
      if ( this.viewModel.hasMeta( ["*", col], "sortable") ){
        this.sortColumn.sortColumn.call( this, col );
      }
    },
    sortColumn : function( col ) {
      var column = this.collection.sortInfo.column || [],
          direction = this.collection.sortInfo.direction || [],
          colID = this.viewModel.getColID(col),
          index = _.indexOf( column, colID ),
          sortState = index === -1 ? 0 : (direction[index] === "asc" ? 1 : 2);
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
    draggedColumn : null,
    _wrapMoveEvent: null,
    _wrapUpEvent: null,

    _downEvent : function(th) {
      var $th = $(th).closest("th"),
        colOrder = this.viewModel.getOption("colOrder"),
        visibleCol = this.viewModel.getVisibleCol(),
        thIndex, frozenColumn;
      $("body").addClass("noselect");
      if ( $th.length > 0 ) {
        thIndex = $th.index();
        frozenColumn = this.viewModel.getOption("frozenColumn");
        this.columnMove.draggedColumn = thIndex < frozenColumn ? thIndex : thIndex + this.startCol - frozenColumn;
      }

      if ( colOrder[this.columnMove.draggedColumn] !== visibleCol[this.columnMove.draggedColumn] ) {
        this.columnMove.draggedColumn = _(colOrder).indexOf(this.columnMove.draggedColumn);
      }
    },
    downEvent : function(e) {
      var that;

      if ( e.target.className.indexOf('gGrid-headerLabelWrap') > -1 && e.target.tagName !== 'I' ) {
        this.columnMove._downEvent.call( this, e.target);

        that = this;
        this.columnMove._wrapMoveEvent = function(e) { that.columnMove.moveEvent.call( this, e ); };
        this.columnMove._wrapUpEvent = function(e) { that.columnMove.upEvent.call( this, e ); };

        this.columnMove._wrapMoveEvent = _.bind(this.columnMove._wrapMoveEvent, this);
        this.columnMove._wrapUpEvent = _.bind(this.columnMove._wrapUpEvent, this);

        document.addEventListener('mousemove', this.columnMove._wrapMoveEvent, true);
        document.addEventListener('mouseup', this.columnMove._wrapUpEvent, true);
      }
    },
    _moveEvent : function(el) {
      var $th = $(el).closest("th"),
        $indicator = this.$el.find(".columnMove-indicator"),
        colOrder = this.viewModel.getOption("colOrder"),
        visibleCol = this.viewModel.getVisibleCol(),
        thIndex, frozenColumn, targetIndex;

      if ( $th.length > 0 ) {
        thIndex = $th.index();
        frozenColumn = this.viewModel.getOption("frozenColumn");
        targetIndex = thIndex < frozenColumn ? thIndex : thIndex + this.startCol - frozenColumn;

        if ( colOrder[this.columnMove.targetIndex] !== visibleCol[this.columnMove.targetIndex] ) {
          this.columnMove.targetIndex = _(colOrder).indexOf(this.columnMove.draggedColumn);
        }
        if ( targetIndex === this.columnMove.draggedColumn ) {
          $indicator.addClass("hide").removeClass("show");
        } else {
          $indicator.addClass("show").removeClass("hide").css({
            top : $th.position().top-4,
            height : $th.outerHeight()+8,
            left : $th.position().left + (targetIndex < this.columnMove.draggedColumn ? 0 : $th.outerWidth()) -3
          });
        }
      }
    },
    moveEvent : function(e) {
      if(this.columnMove.draggedColumn) {
        this.columnMove._moveEvent.call( this, e.target );
      }
    },
    _upEvent : function(el) {
      var $th = $(el).closest("th"),
        $indicator = this.$el.find(".columnMove-indicator"),
        colOrder = this.viewModel.getOption("colOrder"),
        visibleCol = this.viewModel.getVisibleCol(),
        thIndex, frozenColumn, targetIndex;
      if ( $th.length > 0 ) {
        thIndex = $th.index();
        frozenColumn = this.viewModel.getOption("frozenColumn");
        targetIndex = thIndex < frozenColumn ? thIndex : thIndex + this.startCol - frozenColumn;

        if ( colOrder[this.columnMove.targetIndex] !== visibleCol[this.columnMove.targetIndex] ) {
          this.columnMove.targetIndex = _(colOrder).indexOf(this.columnMove.draggedColumn);
        }
        if ( this.columnMove.draggedColumn!==targetIndex ) {
          this.moveColumn(this.columnMove.draggedColumn, targetIndex);
        }
      }
      $("body").removeClass("noselect");
      $indicator.addClass("hide").removeClass("show");
      this.columnMove.draggedColumn = null;
    },
    upEvent : function(e) {
      this.columnMove._upEvent.call( this, e.target );
      document.removeEventListener('mousemove', this.columnMove._wrapMoveEvent, true);
      document.removeEventListener('mouseup', this.columnMove._wrapUpEvent, true);
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

      this.frozenColumn.$frozenHandle = this.$el.find(".frozenCol");
      this.frozenColumn.$seperateCol = this.$el.find(".separateCol");
      this.frozenColumn.$indicator = this.$el.find(".columnMove-indicator");

      this.frozenColumn._wrapMoveEvent = function(e){ that.frozenColumn.moveEvent.call( this, e ); };
      this.frozenColumn._wrapUpEvent = function(e){ that.frozenColumn.upEvent.call( this, e ); };

      this.frozenColumn._wrapMoveEvent = _.bind(this.frozenColumn._wrapMoveEvent, this);
      this.frozenColumn._wrapUpEvent = _.bind(this.frozenColumn._wrapUpEvent, this);

      document.addEventListener('mousemove', this.frozenColumn._wrapMoveEvent, true);
      document.addEventListener('mouseup', this.frozenColumn._wrapUpEvent, true);
    },
    _moveEvent : function(clientX) {
      var i,
          endCol = -1,
          colWidth = 0,
          widthSum = 0,
          visibleCol = this.viewModel.getVisibleCol();

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

      this.frozenColumn.$indicator.removeClass("hide").addClass("show").css({
        top : this.$wrapper_div.find("table thead").position().top,
        height : this.$wrapper_div.find("table thead").outerHeight(),
        left : widthSum
      });
    },
    moveEvent : function(e) {
      this.frozenColumn._moveEvent.call( this, e.clientX );
    },
    _upEvent : function() {
      this.frozenColumn.$seperateCol.removeClass("show").addClass("hide");
      this.frozenColumn.$indicator.removeClass("show").addClass("hide");
      this.viewModel.setOption("frozenColumn", this.frozenColumn.newFrozenCol);
      this.drawByScroll();
    },
    upEvent : function(e) {
      this.frozenColumn._upEvent.call( this, e.target );

      document.removeEventListener('mousemove', this.frozenColumn._wrapMoveEvent, true);
      document.removeEventListener('mouseup', this.frozenColumn._wrapUpEvent, true);
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
    },
    areaDownEvent : function(e){
      this.verticalScroll._areaDownEvent.call( this, e.offsetY );
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

      this.verticalScroll._handleDownEvent.call( this, e.clientY );

      e.preventDefault();
      e.stopPropagation();

      this.verticalScroll._wrapMoveEvent = function(e){ that.verticalScroll.moveEvent.call( this, e ); };
      this.verticalScroll._wrapUpEvent = function(e){ that.verticalScroll.upEvent.call( this, e ); };

      this.verticalScroll._wrapMoveEvent = _.bind(this.verticalScroll._wrapMoveEvent, this);
      this.verticalScroll._wrapUpEvent = _.bind(this.verticalScroll._wrapUpEvent, this);

      document.addEventListener('mousemove', this.verticalScroll._wrapMoveEvent, true);
      document.addEventListener('mouseup', this.verticalScroll._wrapUpEvent, true);
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
      this.verticalScroll._moveEvent.call( this, e.clientY );
    },
    _upEvent : function() {
      this.verticalScroll.pos = null;
    },
    upEvent : function() {
      this.verticalScroll._upEvent.call(this);

      document.removeEventListener('mousemove', this.verticalScroll._wrapMoveEvent, true);
      document.removeEventListener('mouseup', this.verticalScroll._wrapUpEvent, true);
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
      this.horizontalScroll._areaDownEvent.call( this, e.offsetX );
    },
    _handleDownEvent : function(clientX) {
      this.horizontalScroll.pos = {
        left : this.$scrollXHandle.position().left,
        currentX : clientX
      };
    },
    handleDownEvent : function(e) {
      var that = this;
      this.horizontalScroll._handleDownEvent.call( this, e.clientX );

      e.preventDefault();
      e.stopPropagation();

      this.horizontalScroll._wrapMoveEvent = function(e){ that.horizontalScroll.moveEvent.call( this, e ); };
      this.horizontalScroll._wrapUpEvent = function(e){ that.horizontalScroll.upEvent.call( this, e ); };

      this.horizontalScroll._wrapMoveEvent = _.bind(this.horizontalScroll._wrapMoveEvent, this);
      this.horizontalScroll._wrapUpEvent = _.bind(this.horizontalScroll._wrapUpEvent, this);

      document.addEventListener('mousemove', this.horizontalScroll._wrapMoveEvent, true);
      document.addEventListener('mouseup', this.horizontalScroll._wrapUpEvent, true);
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
      this.horizontalScroll._moveEvent.call( this, e.clientX );
    },
    _upEvent : function() {
      this.horizontalScroll.pos = null;
    },
    upEvent : function() {
      this.horizontalScroll._upEvent.call(this);

      document.removeEventListener('mousemove', this.horizontalScroll._wrapMoveEvent, true);
      document.removeEventListener('mouseup', this.horizontalScroll._wrapUpEvent, true);
    }
  },
  scrollByWheel : {
    wheelEvent : function(e) {
      // todo: jquery event에서는 wheel 관련 데이터들이 originalEvent 안에 들어있어서 아래와 같이 함
      var ev = e.originalEvent || e,
          deltaX = 0,
          deltaY = 0;

      if ( 'detail'      in ev ) { deltaY = ev.detail * -1;      }
      if ( 'wheelDelta'  in ev ) { deltaY = ev.wheelDelta;       }
      if ( 'wheelDeltaY' in ev ) { deltaY = ev.wheelDeltaY;      }
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
  clickCell : {
    clickEvent : function(e) {
      var row = $(e.target).closest("tr").index() + this.rowTop,
          tdCol = $(e.target).closest("td").index(),
          frozenColumn = this.viewModel.getOption("frozenColumn"),
          col = tdCol < frozenColumn ? tdCol : tdCol + this.startCol - frozenColumn,
          displayType = this.viewModel.getMeta( [row, col], "displayType");

      if ( cellObjects[displayType][e.type] ) {
        cellObjects[displayType][e.type]( e, this, row, col );
      }
    }
  },
  onModelChange: function ( model ) {
    var rowIndex = model.collection.indexOf(model);
    _.each(model.changed, function(data, colID) {
      this.drawCell(rowIndex, colID);
    }, this);
  },
  onModelAddRemove: function ( model, collection, options ) {
    var index = collection.indexOf(model);
    if(index === -1) {
      index = options.index || 0;
    }
    this.drawTbody( index );
  },
  onReset: function () {
    if ( this.$wrapper_div ) {
      this.viewModel.setOption("scrollLeft", 0, {silent:true});
      this.viewModel.setOption("scrollTop", 0, {silent:true});
      this.setResize();
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
        this.viewModel.updateVisibleCol();
        this.setResize();
      }
      return;
    }

    if( model.hasChanged('closed') && model.type === "row" ) {
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
        $frozenDiv = this.$el.find(".frozenCol"),
        $cols = this.$el.find("colgroup col"),
        frozenArea = this.viewModel.getFrozenArea(),
        visibleCol = this.viewModel.getVisibleCol(),
        topRange = this.$scrollYArea.height() - this.$scrollYHandle.height(),
        widthSum = 0,
        startCol = -1,
        endCol = -1,
        drawFlag = false,
        left, leftRange, i, colWidth, top, rowTop;

    // handle scrollLeft
    if(scrollLeft > scrollXRange) {
      scrollLeft = scrollXRange;
    }
    if(scrollLeft < 0) {
      scrollLeft = 0;
    }
    scrollLeft = parseInt(scrollLeft, 10);
    this.viewModel.setOption("scrollLeft", scrollLeft, {silent:true});

    // set frozenArea
    $frozenDiv.css( "left", frozenArea ).toggleClass("hide", !frozenArea).toggleClass("show", !!frozenArea);
    this.$scrollXArea.css( "left", frozenArea );
    
    // set scrollXHandle's width and left
    this.$scrollXHandle.width( this.$scrollXArea.width() * this.tableWidth / this.wholeTblWidth );
    leftRange = this.$scrollXArea.width() - this.$scrollXHandle.width();
    // left : leftRange = scrollLeft : scrollXRange
    left = leftRange * scrollLeft / (this.wholeTblWidth - this.tableWidth);
    this.$scrollXHandle.css("left", left + "px");

    for ( i = frozenColumn; i < visibleCol.length; i++ ) {
      colWidth = this.viewModel.getMeta( ["*", i], "width" );
      widthSum += colWidth;

      if ( startCol === -1 ) {
        if ( widthSum - colWidth / 2 >= scrollLeft ) {
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

    this.$scrollXArea.css( "opacity",
        this.$scrollXArea.width() <= this.$scrollXHandle.width() ? 0 : 1 );

    if ( this.startCol !== startCol || this.endCol !== endCol ) {
      this.startCol = startCol;
      this.endCol = endCol;
      for ( i = $cols.length; i <= endCol - startCol + frozenColumn; i++ ) {
        this.$el.find("colgroup").append("<col>");
        this.$el.find("thead tr").append("<th>"+
                                          "<div class='gGrid-headerLabelWrap'>"+
                                            "<div class='gGrid-headerLabelText'>"+
                                        "</th>");
        this.$el.find("tbody tr").append("<td>");
      }
      $cols = this.$el.find("colgroup col");

      this.$el.find('table').width( widthSum + frozenArea );
      _($cols).each(function (col, i) {
        var colIndex = i < frozenColumn ? i : i + startCol - frozenColumn;
        var width = colIndex <= endCol ? this.viewModel.getMeta( ["*", colIndex], "width") : 0;
        
        $(col).width( width );
        if ( width===0 ){
          $(this.getHeaderCell(0, i)).children(0).html("");
        }
      }, this);
      drawFlag = true;
    }

    // handle scrollTop
    if(scrollTop > scrollYRange) {
      scrollTop = scrollYRange;
    }
    if(scrollTop < 0) {
      scrollTop = 0;
    }
    scrollTop = parseInt(scrollTop, 10);
    this.viewModel.setOption("scrollTop", scrollTop, {silent:true});

    top = parseInt(scrollTop * topRange / scrollYRange + 0.5, 10);
    this.$scrollYHandle.css( "top", top + "px" );

    rowTop = parseInt(scrollTop / 20, 10);
    if ( this.rowTop !== rowTop ) {
      this.rowTop = rowTop;
      drawFlag = true;
    }

    this.$scrollYArea.css( "opacity",
      this.$scrollYArea.height() <= this.$scrollYHandle.height() ? 0 : 1 );

    if(drawFlag) {
      this.drawHeader();
      this.drawTbody();
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
    }
    if ( model.hasChanged("scrollLeft") || model.hasChanged("scrollTop") ) {
      this.drawByScroll();
    }
    if ( model.hasChanged("width") ) {
      this.$el.css( "width", model.get("option").value["width"] );
      this.setResize();
    }
  },
  getHeaderCell: function ( rowNum, colNum ) {
    return this.$el.find("table thead tr:nth-child(" + (rowNum + 1) + ")").find(
      "th:nth-child(" + (colNum + 1) + ")")[0];
  },
  getTbodyCell: function ( rowNum, colNum ) {
    return this.$el.find("table tbody tr:nth-child(" + (rowNum + 1) + ")").find(
      "td:nth-child(" + (colNum + 1) + ")")[0];
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
        tdCol = colIndex < frozenColumn ? colIndex : colIndex-this.startCol+frozenColumn,
        cell = this.getHeaderCell(0, tdCol),
        label = this.viewModel.getMeta( ["*", col], "headerLabel"),
        $labelNode = $("<div class='gGrid-headerLabelText'></div>"),
        $sortStateNode = $("<i class='w5-grid-sort'></i>");

    if (cell) {
      $labelNode.append(label).attr("abbr", label);
      if( this.viewModel.hasMeta( ["*", col], "sortable") ){
        $labelNode.append($sortStateNode);
      }

      $(cell).children(0).html("")
          .append($labelNode)
          .append(this.getColMenu(colIndex))
          .append(this.getAdjustColHandle(colIndex));
    }

    // Left show button show/hide 처리
    var idx = _(colOrder).indexOf(visibleCol[col]),
        leftColumnID = colOrder[idx - 1];

    if( idx === 0 || _(visibleCol).indexOf(leftColumnID) >= 0 ) {
      $(cell).find(".display-left .w5-grid-column-show").addClass("hide");
    } else {
      $(cell).find(".display-left .w5-grid-column-show").removeClass("hide");
    }

    // sort 상태 아이콘 표시
    var column = this.collection.sortInfo.column || [],
        direction = this.collection.sortInfo.direction || [],
        btnClass = ["state-none", "state-asc", "state-desc"],
        textNode = ["Sort None", "Sort Ascending", "Sort Descending"],
        colID = this.viewModel.getColID(col),
        index = _.indexOf( column, colID ),
        sortState = index === -1 ? 0 : (direction[index] === "asc" ? 1 : 2);

    $(cell).find(".w5-grid-sort").addClass(btnClass[sortState])
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
        $cell, data, cellObject, style, className;

    if( !inColRange || !inRowRange ) {
      return;
    }
    $cell = $(this.getTbodyCell(row-this.rowTop, tdCol));

    if ( $cell.length > 0 ) {
      if ( row < this.viewModel.getDataLength() ) {
        data = this.viewModel.getData( [row, col] );
        cellObject = cellObjects[this.viewModel.getMeta( [row, col], "displayType" )];
        $cell.html("").append(cellObject.getContent(this, data, row, colIndex));
        style = this.viewModel.getMeta( [row, col], "style" );
        className = this.viewModel.getMeta( [row, col], "class" ) || "";
      } else {
        $cell.html("");
        style = null;
        className = "";
      }
      $cell[0].style.cssText = "";
      if(style) {
        $cell.css( style );
      }
      $cell.attr("class", className);
    }
  },
  getAdjustColHandle: function () {
    var grid = this;

    var adjustCol = {
      $adjustHandle  : $("<i class='adjustCol-handle'>Adjust this Column</i>"),
      $seperateColHover : grid.$el.find(".adjustCol-handle-hover"),
      $seperateCol   : grid.$el.find(".separateCol"),
      targetCol      : 0,
      targetColW     : 0,
      draggingX      : 0,
      colDragInfo    : {},    //변하는 중인 col의 width

      downEvent : function(e) {
        var $metaCol = grid.$wrapper_div.find("thead th").eq($(e.target).parent().closest("th").index() + 1);
        this.targetCol = $(e.target).parent().closest("th").index();
        this.targetColW = $(e.target).parent().closest("th").width();

        this.colDragInfo = {
          posX : e.clientX,
          startX : $metaCol.position().left
        };

        this.$seperateCol.css("left", this.colDragInfo.startX);
        this.$seperateCol.removeClass("hide").addClass("show");
        this.$seperateColHover.css("left", this.colDragInfo.startX);
        this.$seperateColHover.removeClass("hide").addClass("show");

        document.addEventListener('mousemove', this.moveEvent, true);
        document.addEventListener('mouseup', this.upEvent, true);

        e.stopPropagation();
      },
      moveEvent : function(e) {
        this.draggingX = e.clientX - this.colDragInfo.posX;
        this.$seperateCol.css("left", this.colDragInfo.startX+this.draggingX-this.$seperateCol.width());
        $("body").addClass("sizingH");
      },
      upEvent : function() {
        var frozenColumn = grid.viewModel.getOption("frozenColumn");
        if (this.targetCol >= frozenColumn) {
          this.targetCol += grid.startCol - frozenColumn;
        }
        var colWidth = grid.viewModel.getMeta( ["*", this.targetCol], "width" );

        // todo: removeMeta, setMeta에서 각각 다시 그리므로 silent 처리 필요
        grid.viewModel.removeMeta( ["*", this.targetCol], "flex", {silent:true} );
        grid.viewModel.setMeta( ["*", this.targetCol], "width", colWidth + this.draggingX );
        
        this.$seperateCol.removeClass("show").addClass("hide");
        this.$seperateColHover.removeClass("show").addClass("hide");
        $("body").removeClass("sizingH");

        document.removeEventListener('mousemove', this.moveEvent, true);
        document.removeEventListener('mouseup', this.upEvent, true);
      }
    };
    
    _(adjustCol).bindAll("downEvent", "moveEvent", "upEvent");
    adjustCol.$adjustHandle.on("mousedown", adjustCol.downEvent);

    return adjustCol.$adjustHandle;
  },
  colLeftMenu: _.template(
      "<div class='gGrid-colMenu display-left'>"+
        "<i class='w5-grid-column-show'></i>"+
      "</div>"
  ),
  colRightMenu: _.template(
    "<div class='gGrid-colMenu display-right'>"+
      "<i class='w5-grid-colMenu-icon'></i>"+ 
      "<ul class='w5-dropdown-menu form-none' role='menu'>"+
      "<li><a class='w5-dropdown-menu-label column-hide' role='menuitem' href='#'>Column Hide</a></li>"+
      "</ul>"+
    "</div>"
  ),
  getColMenu: function ( col ) {
    var grid = this,
        $colMenu = $(document.createDocumentFragment()),
        $leftMenu = $(this.colLeftMenu()),
        $rightMenu = $(this.colRightMenu()),
        $menuIcon = $rightMenu.find(".w5-grid-colMenu-icon"),
        colOrder = grid.viewModel.getOption("colOrder"),
        visibleCol = grid.viewModel.getVisibleCol(),
        frozenCol = grid.viewModel.getOption("frozenColumn");

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
          throw {
            name: "UsageException",
            message: "Section of the column to a frozen column can not be show. \n"+
                     "First, turn off the frozen column."
          };
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
      _openColMenu : function( menuBtn ){
        var checkMenuPos = 0,
            $cell = $(menuBtn).closest("th"),
            colIdx = $cell.index(),
            i;

        grid.$el.find("thead th .display-right").removeClass("open");
        grid.$el.find("thead th .display-right .w5-grid-colMenu-icon").removeClass("on");
        
        for ( i=0; i<=colIdx; i++ ){
          checkMenuPos += grid.$el.find("thead th").eq(i).width();
        }
        if ( checkMenuPos > grid.$wrapper_div.width()-$cell.find(".display-right .w5-dropdown-menu").width() ){
          $cell.find(".display-right .w5-dropdown-menu").css({
            left : "initial",
            right : "0px"
          });
        }

        $rightMenu.addClass("open");
        $(menuBtn).addClass("on");
      },
      openColMenu : function(e){
        this._openColMenu(e.target);
      },
      _closeColMenu : function () {
        $rightMenu.removeClass("open");
        $menuIcon.removeClass("on");
      },
      closeColMenu : function(e){
        this._closeColMenu(e.target);  
      },
      _hideCol : function () {
        var remainCol = grid.viewModel.getVisibleCol().length;

        if ( remainCol!==1 ){
          if ( col>=frozenCol ){
            grid.viewModel.setMeta(["*", col], "hidden", true);
            grid.viewModel.updateVisibleCol();
          } else {
            throw {
              name: "UsageException",
              message: "Section of the column to a frozen column can not be hidden. \n"+
                       "First, turn off the frozen column."
            };
          }
        } else {
          throw {
            name: "UsageException",
            message: "W5 Grid is must have a column."
          };
        }
      },
      hideCol : function ( e ) {
        this._hideCol( e.target );
        e.preventDefault();
      }
    };

    _(rightMenu).bindAll("openColMenu", "closeColMenu", "hideCol");
    $rightMenu.find(".w5-grid-colMenu-icon").on("click", rightMenu.openColMenu);  
    $rightMenu.find(".w5-dropdown-menu li").eq(0).on("click", rightMenu.hideCol);  
    grid.$el.on("mouseleave", rightMenu.closeColMenu);
    $colMenu.append($rightMenu);

    if ( this.viewModel.getMeta(["*", col], "colMenu")!=="hidden" ){
      return $colMenu;   
    }
  },
  setFlex: function () {
    var restWidth = this.tableWidth,
        widthSum = 0,
        flexArr = [],
        flexSum = 0;

    _(this.viewModel.getVisibleCol()).each( function(obj, col) {
      if ( this.viewModel.hasMeta( ["*", col], "flex") ) {
        var flex = this.viewModel.getMeta( ["*", col], "flex");
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
    this.$scrollYHandle.height( this.$el.find("tbody tr").length * this.$scrollYArea.height() / this.viewModel.getDataLength());
    this.$scrollXHandle.width( this.$scrollXArea.width() * this.tableWidth / this.wholeTblWidth );
    
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
  redraw: function() {
    this.setResize();
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
    var colOrder = this.viewModel.getOption("colOrder").slice(),
        col = colOrder.splice(fromCol, 1)[0];
    colOrder.splice(toCol, 0, col);
    this.viewModel.setOption("colOrder", colOrder);
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
  reset: function(data) {
    data = data || [];

    this.viewModel.model.meta.table.clear({silent:true});
    this.viewModel.model.meta.row.reset([], {silent:true});
    this.viewModel.model.meta.column.reset([], {silent:true});
    this.viewModel.model.meta.cell.reset([], {silent:true});

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
  sort: function ( columns, directions ) {
    this.viewModel.sort( columns, directions );
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
  setColumnVisible: function(col, visibility){
    if ( _.isNumber(col) ){
      this.viewModel.setMeta(["*", col], "hidden", !visibility, {inorder:true});   
    }
    if ( _.isArray(col) ){
      _(col).each(function(item){
        this.viewModel.setMeta(["*", item], "hidden", !visibility, {inorder:true});   
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
  fetch: function ( model, options ) {
    this.viewModel.fetch( model, options );
    return this;
  },
  syncData: function ( options ) {
    this.viewModel.syncData( options );
    return this;
  },
  getGridData: function () {
    return this.viewModel.getGridData();
  },
  find: function ( selector, context, results ) {
    results = results || [];
    var matched;

    matched = this.matchExp.exec(selector);
    context = context || this;

    if ( matched && ( matched[1] === 'row' || matched[1] === 'column' ) ) {
      context = context['collection'];

      if ( matched[2] === 'removed' ) {
        Array.prototype.push.apply( results, context.__removeModels );
      }
    }

    return results;
  },
  matchExp: /(cell|row|column):(\S+)/i,
  getChildren: function(parentEls, tagName, attribute) {
    var unique_check = {},
        elems = [],
        i, j, k,
        row, col, colName;
    for(k = 0; k < parentEls.length; k++) {
      row = parentEls[k][0];
      col = parentEls[k][1];
      // add cols in table or cells in row
      if(col === "*") {
        if(!tagName || // tagName이 주어지지 않았거나
            (row === "*" && tagName === "col") ||  // parent가 table일 경우에는 tagName === "col"
            (row !== "*" && tagName === "cell")) { // parent가 row일 경우에는 tagName === "cell"
          for(i = 0; i < this.viewModel.colModel.length; i++) {
            colName = this.viewModel.getColID(i);
            if(!unique_check[row + "_" + colName]) {
              unique_check[row + "_" + colName] = 1;
              elems.push([row, colName]);  
            }
          }
        }
      }
      // add rows in table or cells in col
      if(row === "*") {
        if(!tagName || // tagName이 주어지지 않았거나
            (col === "*" && tagName === "row") ||  // parent가 table일 경우에는 tagName === "row"
            (col !== "*" && tagName === "cell")) { // parent가 row일 경우에는 tagName === "cell"
          for(i = 0; i < this.collection.length; i++) {
            if(!unique_check[i + "_" + col]) {
              unique_check[i + "_" + col] = 1;
              elems.push([i, col]);  
            }
          }
        }
      }
      // add cells in table
      if(row === "*" && col === "*" && (!tagName || tagName === "cell")) {
        for(i = 0; i < this.collection.length; i++) {
          for(j = 0; j < this.viewModel.colModel.length; j++) {
            colName = this.viewModel.getColID(j);
            if(!unique_check[i + "_" + colName]) {
              unique_check[i + "_" + colName] = 1;
              elems.push([i, colName]);
            }
          }
        }
      }
    }
    if(attribute) {
      var attr = /\[([^=]+)=([^\]]+)\]/g.exec(attribute),
          attrName = attr[1],
          attrValue = attr[2],
          newEls = [],
          val;
      for(i = 0; i < elems.length; i++) {
        if(attrName === "data") {
          val = this.viewModel.getData(elems[i]);
        } else {
          val = this.viewModel.getMeta(elems[i], attrName);
        }
        if(String(val) === attrValue) {
          newEls.push(elems[i]);
        }
      }
      elems = newEls;
    }
    return elems;
  },
  select: function(str) {
    var sel = str.match(/[^ ]+/g),
        parentEls = [["*", "*"]], // start with a table
        els, i;
    for(i = 0; i < sel.length; i++) {
      if(sel[i].match(/^[^\[\s]+\[[^\]]+\]|^[^\[\s]+/g)) {
        var tagName = (sel[i].match(/^[^\[]*/g) || [])[0],
            attribute = (sel[i].match(/\[[^\]]+\]$/g) || [])[0];

        els = this.getChildren(parentEls, tagName, attribute);
        parentEls = els;
      } else {
        els = [];
        break;
      }
    }
    return new GridSelector(this, els);
  }
};
