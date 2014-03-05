module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  function process( code ) {
    return code

      // Embed version
      .replace( /@VERSION/g, grunt.config( "pkg" ).version )

      // Embed homepage url
      .replace( /@HOMEPAGE/g, grunt.config( "pkg" ).homepage )

      // Embed date (yyyy-mm-ddThh:mmZ)
      .replace( /@DATE/g, ( new Date() ).toISOString().substr(0, 10) );
  }

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      "basic": {
        options: { process: process },
        src: [
          "src/intro.js",
          "src/init.js",
          "src/data.js",
          "src/grid.js",
          "src/api.js",
          "src/cell.js",
          "src/export.js",
          "src/outro.js"
        ],
        dest: "js/w5.js"
      }
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: ['js/w5.js'],
        dest: 'dist/js/<%= pkg.name %>.min.<%= pkg.version %>.js'
      }
    },
    copy: {
      js: {
        files: [
          {
            expand: true,
            cwd: 'js',
            src: ['*.js'],
            dest: 'dist/js',
            rename: function ( dest, src ) {
              return dest + '/' + src.substring( 0, src.indexOf('.js') ) + '.<%= pkg.version %>.js';
            }
          },
          {
            expand: true,
            cwd: 'dist/js',
            src: ['*.js'],
            dest: 'www-root/javascripts/'
          }
        ]
      }
    },
    connect: {
      server: {
        options: {
          base: 'www-root',
          port: 8000,
          keepalive: true,
          open: 'http://localhost:8000',
          hostname: "*"
        }
      }
    },
    jshint: {
      js: {
        src: ['js/w5.js'],
        options: {
          curly: true,
          eqeqeq: true,
          immed: true,
          latedef: true,
          newcap: true,
          noarg: true,
          sub: true,
          undef: true,
          unused: true,
          boss: true,
          eqnull: true,
          node: true,
          browser: true             // use document
        }
      }
    },
    less: {
      miniCss: {
        options: {
          cleancss: true
        },
        files: {
          "dist/css/w5.min.css": "src/grid.less"
        }
      },
      css: {
        files: {
          "dist/css/w5.css": "src/grid.less"
        }
      }
    },
    clean: ['js/w5.js', 'www-root/javascripts']
  });

  grunt.registerTask('default', ['clean', 'concat:basic', 'jshint:js', 'uglify', 'copy:js', 'less']);
  grunt.registerTask('startup', ['connect:server']);
  grunt.registerTask('clear', ['clean']);
};
