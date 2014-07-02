requirejs.config({
  paths: {
    'jquery': '//ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js',
    'underscore': '//cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min.js',
    'Backbone': '//cdnjs.cloudflare.com/ajax/libs/backbone.js/1.1.2/backbone-min.js',
    'w5': '//w5.io/dist/js/w5.min.0.6.0.js'
  },

  shim: {
    'Backbone': ['jquery', 'underscore'],
    'w5': ['Backbone']
  }
});
