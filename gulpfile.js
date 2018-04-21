const gulp = require('gulp')
const util = require('gulp-util')
const sass = require('gulp-sass')
const uglify = require('gulp-uglify')
const rename = require('gulp-rename')
const handlebars = require('gulp-hb')
const browserSync = require('browser-sync')
const sassGlob = require('gulp-sass-bulk-import')
const watch = require('gulp-watch')
const browserify = require('browserify')
const source = require('vinyl-source-stream')
const babelify = require('babelify')
const gutil = require('gulp-util')
const buffer = require('vinyl-buffer')
const sourcemaps = require('gulp-sourcemaps')
const sequence = require('run-sequence')
const postcss = require('gulp-postcss')
const cssnext = require('postcss-cssnext')
const cssnano = require('cssnano')({ autoprefixer: false })
const frontMatter = require('gulp-front-matter')
const rev = require('gulp-rev')
const revReplace = require('gulp-rev-replace')
const del = require('del')

const paths = {
  src: { root: 'src' },
  dist: { root: 'dist' },
  init: function () {
    this.src.sass = this.src.root + '/scss/index.scss'
    this.src.templates = this.src.root + '/**/*.hbs'
    this.src.js = [this.src.root + '/js/**/*.js', '!' + this.src.root + '/js/libs/*.js']
    this.src.libs = this.src.root + '/js/libs/*.js'
    this.src.static = this.src.root + '/static/**/*.*'
    this.src.files = this.src.root + '/*.{html,txt}'
    this.dist.css = this.dist.root + '/css'
    this.dist.static = this.dist.root + '/static'
    this.dist.js = this.dist.root + '/js'
    this.dist.libs = this.dist.root + '/js/libs'

    return this
  }
}.init()

// Browsersync
gulp.task('serve', function () {
  browserSync.init({
    server: paths.dist.root,
    open: false,
    notify: false,
    online: false
  })
})

// Hash CSS and JS
gulp.task('rev', function () {
  return gulp.src([`${paths.dist.css}/*.css`, `${paths.dist.js}/*.js`], {base: paths.dist.root})
    .pipe(gulp.dest(paths.dist.root))
    .pipe(rev())
    .pipe(gulp.dest(paths.dist.root))
    .pipe(rev.manifest())
    .pipe(gulp.dest(paths.dist.root))
})

// Re-write paths to rev'd CSS and JS
gulp.task('revreplace', ['rev'], function () {
  const manifest = gulp.src(`./${paths.dist.root}/rev-manifest.json`)
  return gulp.src(`./${paths.dist.root}/**/*.html`)
    .pipe(revReplace({manifest: manifest}))
    .pipe(gulp.dest(paths.dist.root))
})

// Styles (Sass)
gulp.task('styles', function () {
  const plugins = [
    cssnext(),
    cssnano
  ]
  return gulp.src([paths.src.sass])
    .pipe(sourcemaps.init())
    .pipe(sassGlob())
    .on('error', util.log)
    .pipe(sass({
      includePaths: ['src/scss']
    }))
    .on('error', util.log)
    .pipe(postcss(plugins))
    .pipe(sourcemaps.write('./maps'))
    .pipe(gulp.dest(paths.dist.css))
    .pipe(browserSync.reload({stream: true}))
})

// Compile handlebars/partials into html
gulp.task('templates', function () {
  return gulp.src([paths.src.root + '/*.hbs'])
    .pipe(frontMatter({
      property: 'data.frontMatter'
    }))
    .pipe(handlebars()
      .partials('./src/partials/**/*.hbs'))
    .helpers([
      `./${paths.src.root}/helpers/**/*.js`
    ])
    .data('./src/data/**/*.{js,json}')
    .on('error', util.log)
    .pipe(rename({
      extname: '.html'
    }))
    .on('error', util.log)
    .pipe(gulp.dest(paths.dist.root))
    .pipe(browserSync.reload({stream: true}))
})

// Bundle JS (Browserify & Babel)
gulp.task('scripts:bundle', function () {
  return browserify({
    entries: './src/js/index.js',
    debug: true
  })
    .transform(babelify, {presets: ['@babel/preset-env']})
    .bundle()
    .on('error', err => {
      gutil.log('Browserify Error', gutil.colors.red(err.message))
    })
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({loadMaps: true}))
    .pipe(uglify())
    .pipe(sourcemaps.write('./maps'))
    .on('error', util.log)
    .pipe(gulp.dest(paths.dist.js))
    .pipe(browserSync.reload({stream: true}))
})

// Minify vendor libs
gulp.task('scripts:libs', function () {
  return gulp.src([paths.src.libs])
    .pipe(uglify())
    .on('error', util.log)
    .pipe(gulp.dest(paths.dist.libs))
    .pipe(browserSync.reload({stream: true}))
})

// Copy Static Assets
gulp.task('copy:static', function () {
  return gulp.src([paths.src.static])
    .pipe(gulp.dest(paths.dist.static))
    .pipe(browserSync.reload({stream: true}))
})

// Copy Static HTML and TXT
gulp.task('copy:files', function () {
  return gulp.src([paths.src.files])
    .pipe(gulp.dest(paths.dist.root))
    .pipe(browserSync.reload({stream: true}))
})

// Delete Dist
gulp.task('clean', function () {
  return del([paths.dist.root])
})

// Watch
gulp.task('watch', function () {
  watch(paths.src.static, function () {
    gulp.start('copy:static')
  })
  watch(paths.src.files, function () {
    gulp.start('copy:files')
  })
  watch(`${paths.src.root}/data/**`, function () {
    gulp.start('templates')
  })
  gulp.watch('src/scss/**/*.scss', ['styles'])
  gulp.watch(paths.src.js, ['scripts:bundle'])
  gulp.watch(paths.src.libs, ['scripts:libs'])
  gulp.watch(paths.src.templates, ['templates'])
})

// Default task
gulp.task('default', ['watch', 'serve', 'copy:static', 'copy:files', 'styles', 'scripts:libs', 'scripts:bundle', 'templates'])

// Production Build
gulp.task('build', function (callback) {
  sequence(
    'clean',
    ['copy:static', 'copy:files', 'styles', 'scripts:libs', 'scripts:bundle', 'templates'],
    'revreplace',
    callback
  )
})
