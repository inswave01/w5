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
