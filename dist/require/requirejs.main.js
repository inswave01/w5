requirejs.config({
  paths: {
    'jquery': 'https://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min',
    'underscore': 'https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min',
    'Backbone': 'https://cdnjs.cloudflare.com/ajax/libs/backbone.js/1.1.2/backbone-min',
    'w5': 'https://w5.io/dist/js/w5.min.0.6.0'
  },

  shim: {
    'w5': ['jquery', 'underscore', 'Backbone']
  }
});
