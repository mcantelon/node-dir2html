require('./src/node-directory-view')

var sys = require('sys'),
	http = require('http'),
	url = require('url'),
	path = require('path'),
	fs = require('fs'),
	Sessions = require('./nodejs-sessions/session')

var SessionManager = new Sessions.manager({
    lifetime: (60 * 60)
})

// static file handler for images
function serve_static_file(response, filename) {

	fs.readFile(filename, 'binary', function(err, file) {

		if (err) {  
			response.sendHeader(500, {"Content-Type": "text/plain"})  
			response.write(err + "\n")  
			response.close()  
			return  
		}  

		response.sendHeader(200)
		response.write(file, 'binary')  
		response.close()  
	})  
}

http.createServer(function (request, response) {

	var base_dir,
		start_dir,
		url_data,
		query_data,
		session,
		rel_path

	// get URL query parameters
	url_data = url.parse(request.url, true)
	query_data = url_data.query || {}

	if (url_data.pathname.indexOf('/images/') == 0) {
		serve_static_file(response, __dirname + url_data.pathname)
	}
	else {

		// init session variable for directory state
		session = SessionManager.lookupOrCreate(request, response)
		var state = session.data('state')
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
						session.data('state', state)
						response.sendHeader(200, {'Content-Type': 'text/html'})
						// the tag soup below is pretty gross... prolly need to have it use file/dir templates
						var d2h = new DirectoryToHTML(base_dir, start_dir, {
							'parent_link_html': '<a href="/?dir={parent}">[Back]</a>&nbsp;',
							'directory_prefix_html': '<a href="{script}?dir=' + query_data.dir + '&path={path}&toggle={entry}"><img src="/images/folder_{state}.png" border=0 /></a><img src="/images/folder_icon.png">&nbsp;<a href="/?dir={path}{entry}">',
							'directory_suffix_html': '</a>',
							'default_state': 'closed',
							'initial_state': state
						})
						response.write('<html><head></head><body>')
						response.write(d2h.parent_link_html() + d2h.as_html())
						response.write('</body></html>')
						response.close()
					}
				})
			}
		})

	}
}).listen(8000)

sys.puts('Server running at http://127.0.0.1:8000/')
