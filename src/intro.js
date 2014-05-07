/*!
 * w5 @VERSION
 * [@HOMEPAGE]
 *
 * Copyright 2013 Inswave Foundation and other contributors
 * Released under the LGPLv3.0 license
 *
 * Date: @DATE
 */

(function(root, factory) {
  /* global define */
  if ( typeof define === 'function' && define.amd ) {
    define( ['jquery', 'underscore', 'Backbone', 'exports'], function( $, _, Backbone, exports ) {
      root.w5 = factory( $, _, Backbone, root, exports );
    });
  } else {
    root.w5 = factory( (root.jQuery || root.$), root._, root.Backbone, root, {} );
  }

}( this, function( $, _, Backbone, window, w5 ) {

    "use strict";
