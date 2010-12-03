require('./lib/node-directory-view')

var sys = require('sys'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
        connect = require('connect'),
        MemoryStore = require('connect/middleware/session/memory')

connect.createServer(

  connect.cookieDecoder(),
  connect.session({ store: new MemoryStore({ reapInterval: 60000 * 10 }) }),
  connect.staticProvider(__dirname + '/public'),

  function (request, response) {

	var base_dir,
		start_dir,
		url_data,
		query_data,
		session,
		rel_path

	// get URL query parameters
	url_data = url.parse(request.url, true)
	query_data = url_data.query || {}

	// init session variable for directory state
	var state = request.session.state
	state = state || {}

	// handle directory state change requests
	if (query_data.toggle) {
		rel_path = (query_data.path && query_data.path != '/')
			? query_data.path
			: ''
		rel_path += query_data.toggle
		state[rel_path] = (state[rel_path]) ? false : true
	}

	// set base and start directories
	base_dir = __dirname
	start_dir = (query_data.dir) ? base_dir + '/' + query_data.dir : base_dir

	// if base and start directories exist, show HTML representation of directories
	path.exists(base_dir, function (exists) {
		if (exists) {
			path.exists(start_dir, function (exists) {
				if (exists) {
					query_data.dir = query_data.dir || ''

					request.session.state = state

					response.writeHead(200, {'Content-Type': 'text/html'})

					// the tag soup below is pretty gross... prolly need to have it use file/dir templates
					var d2h = new DirToHTML(base_dir, start_dir, {
						'parent_link_html': '<a href="/?dir={parent}">[Back]</a>&nbsp;',
						'directory_prefix_html': '<a href="{script}?dir=' + query_data.dir + '&path={path}&toggle={entry}"><img src="/images/folder_{state}.png" border=0 /></a><img src="/images/folder_icon.png">&nbsp;<a href="/?dir={path}{entry}">',
						'directory_suffix_html': '</a>',
						'default_state': 'closed',
						'initial_state': state
					})

					response.write('<html><head></head><body>')
					response.write(d2h.parent_link_html() + d2h.as_html())
					response.write('</body></html>')
					response.end()
				}
			})
		}
	})

}).listen(8000)

sys.puts('Server running at http://127.0.0.1:8000/')
