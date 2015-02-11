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
          "src/menu.js",
          "src/export.js",
          "src/formatter.js",
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
        dest: 'dist/js/<%= pkg.version %>/<%= pkg.name %>.min.js'
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
              return dest + '/<%= pkg.version %>/' + src.substring( 0, src.indexOf('.js') ) + '.js';
            }
          },
          {
            expand: true,
            cwd: 'dist/js',
            src: ['*.js'],
            dest: 'www-root/javascripts/'
          }
        ]
      },
      resources: {
        files: [
          {
            expand: true,
            cwd: 'resources',
            src: 'images/*',
            dest: 'dist/'
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
          browser: true,             // use document
          evil: true
        }
      }
    },
    less: {
      miniCss: {
        options: {
          cleancss: true
        },
        files: {
          "dist/css/w5.min.css": "resources/less/*.less"
        }
      },
      css: {
        files: {
          "dist/css/w5.css": "resources/less/*.less"
        }
      }
    },
    clean: ['js/w5.js', 'www-root/javascripts']
  });

  grunt.registerTask('default', ['clean', 'concat:basic', 'jshint:js', 'uglify', 'copy:js', 'copy:resources', 'less']);
  grunt.registerTask('startup', ['connect:server']);
  grunt.registerTask('clear', ['clean']);
};
