var headerContextMenu;

var ContextMenuView = Backbone.View.extend( {
  initialize: function( options ) {
    options = options || {};
    this.grid = options.grid;
    this.render();
  },
  render: function() {
    return this;
  },
  events: function() {
    var handlers = {
      'mouseleave': 'hide',
      'click li .column-hide': 'hideCol',
      'click li .frozen-column': 'frozenCol'
    };

    return handlers;
  },
  grid: null,
  defaultMenus: _.template(
    "<li id='buttonLi'>" +
      "<a href='#' role='menuitem' class='w5-dropdown-menu-label column-hide'>Column Hide</a>" +
    "</li>" +
    "<li>" +
      "<a href='#' role='menuitem' aria-disabled='false' " +
      "class='w5-dropdown-menu-label frozen-column <%= disabled %>' <%= aria_disabled %>><%= setFrozenColumn %> Frozen Column</a>" +
    "</li>"
  ),
  colIdx: -1,
  colID: '',
  renderList: function( colID ) {
    var defaultTemplateVars = { disabled: '', aria_disabled: '', setFrozenColumn: 'Set' },
        scrollLeft = this.grid.viewModel.getOption("scrollLeft"),
        frozenCol = this.grid.viewModel.getOption("frozenColumn"),
        listText;

    if ( scrollLeft !== 0 ) {
      defaultTemplateVars.disabled = 'disabled';
      defaultTemplateVars.aria_disabled = 'true';
    } else if ( colID === this.grid.viewModel.getColID(frozenCol - 1) ) {
      defaultTemplateVars.setFrozenColumn = 'Release';
    }
    listText = this.defaultMenus(defaultTemplateVars);

    this.$('ul').empty();
    this.$('ul').append( listText );
  },
  hide: function(e) {
    var cell,
      activeEle = document.activeElement;

    if ( activeEle.tagName !== 'SELECT' || this.$el[0] !== $(activeEle).closest('.w5-dropdown-menu')[0] ) {
      this.$el.removeClass('open');
      this.$('ul').empty();

      if ( e && ( ( e.type && e.type === 'mouseleave' ) || ( e.target && e.target.id === 'w5FilterCancel' ) ) ) {
        cell = this.grid.getHeaderCell( 0, this.grid.getTargetCol(this.colIdx) );
        if ( cell ) {
          $(cell).find(".w5-grid-colMenu-icon").removeClass('on');
          $(cell).find('.display-right').addClass('hide');
        }
      }
    }
  },
  show: function( left, top, colIdx, colID ) {
    this.colIdx = colIdx;
    this.colID = colID;

    this.renderList( colID, true );

    this.$el.css({
      left: left,
      top: top
    }).addClass('open');

    this.$('li').first().find('a').focus();
  },
  hideCol: function() {
    var remainCol = this.grid.viewModel.getVisibleCol().length,
        frozenCol = this.grid.viewModel.getOption("frozenColumn");

    this.hide( { type: 'mouseleave'} );

    if ( remainCol !== 1 ) {
      if ( this.colIdx >= frozenCol ) {
        this.grid.viewModel.setMeta(["*", this.colIdx + this.grid.startCol - frozenCol], "hidden", true);
        this.grid.viewModel.updateVisibleCol();
      } else {
        throw new Error( "Section of the column to a frozen column can not be hidden." +
        "\nFirst, turn off the frozen column." );
      }
    } else {
      throw new Error( "W5 Grid is must have a column." );
    }
  },
  frozenCol: function(e) {
    if ( !$(e.target).hasClass('disabled') ) {
      var frozenCol = this.grid.viewModel.getOption("frozenColumn");

      if ( frozenCol === ( this.colIdx + 1 ) ) {
        frozenCol = 0;
      } else {
        frozenCol = this.colIdx + 1;
      }
      this.hide( { type: 'mouseleave' } );
      this.grid.viewModel.setOption( "frozenColumn", frozenCol );
    }
  }
} );
