var fs = require('fs'),
	path = require('path'),
	sys = require('sys')

DirectoryToHTML = function(base_path, start_path, options) {
	this.initialize(base_path, start_path, options)
}

DirectoryToHTML.prototype = {

	initialize:function(base_path, start_path, options) {

		options = options || {}

		this.base_path = this._check_path(base_path)
		this.start_path = this._check_path(start_path)
		this.relative_path = this.absolute_to_relative_path(start_path)
		this.parent_relative_path = this._parent_relative_path()

		this._process_options(options)

		this.tree = this.directory_tree_as_hash(this.start_path)
	},

	_process_options:function(options) {

		this.options = options

		var defaults = {
			'default_state': 'open',
			'indent_html': '&nbsp;&nbsp;&nbsp;&nbsp;',
			'break_html': "<br/>",
			'directory_prefix_html': '(F)&nbsp;'
		}

		for(option in defaults) {
			this.options[option] = (options[option]) ? options[option] : defaults[option]
		}

		this._initialize_state(options['initial_state'])
	},

	_initialize_state:function(initial_state) {

		var state_key

		initial_state = initial_state || {}

		this.state = {}

		for(relative_path in initial_state) {

			if (initial_state[relative_path]) {

				state_key = this._normalize_path(this.base_path) + '/' + relative_path
				this.state[state_key] = true
			}
		}
	},

	// refactor?
	absolute_to_relative_path:function(path) {

		var base_path_length = this._normalize_path(this.base_path).length

		var rel_path_length = this._normalize_path(path).length - base_path_length

		return this._normalize_path(path).substring(base_path_length + 1, base_path_length + 1 + rel_path_length)
	},

	directory_tree_as_hash:function(current_directory, current_depth) {

		current_depth = current_depth || 0

		var entry,
			absolute_path,
			directory_hash = {},
			directory_as_array = this.directory_as_array(current_directory)

		for(var index in directory_as_array) {

			entry = directory_as_array[index]
			absolute_path = this._normalize_path(current_directory) + '/' + entry

			directory_hash[entry] = {
				'type': (this.is_dir(absolute_path)) ? 'directory' : 'file'
			}

			directory_hash[entry].children = this.is_dir(absolute_path)
				? this.directory_tree_as_hash(absolute_path, current_depth + 1)
				: false
		}

		return directory_hash
	},

	directory_as_array:function(directory) {

		return fs.readdirSync(directory)
	},

	as_html:function() {

		return this.render_directory_hash(this.tree)
	},

	parent_link_html:function() {

		var output = ''

		if (this.relative_path != '' && this.options.parent_link_html) {
			output += this.options.parent_link_html.replace('{parent}', this._parent_relative_path())
		}

		return output
	},

	// if there's a relative path, it gets slash added to end
	_assemble_relative_path_to_entry:function(current_path) {

		// relative path to entry starts with start dir relative to base dir
		var relative_path_to_entry = (this.relative_path)
			? this.relative_path + '/'
			: ''

		// add on current path depth
		relative_path_to_entry += (current_path != '')
			? current_path
			: ''

		return relative_path_to_entry
	},

	_render_directory_prefix:function(current_path, entry, context) {
		
		var absolute_path = this._normalize_path(this.start_path) + '/'
			+ (current_path) ? current_path : ''
			+ entry

		return this._replace_tags(this.options.directory_prefix_html, context)
	},

	render_directory_hash:function(directory_hash, current_depth, current_path) {

		var output = '',
			data,
			relative_path_to_entry,
			context,
			absolute_path

		current_depth = current_depth || 0
		current_path = current_path || ''

		for(var entry in directory_hash) {

			data = directory_hash[entry]

			relative_path_to_entry = this._assemble_relative_path_to_entry(current_path)

			// context for replacement of tags
			context = {
				'entry': entry,
				'path': relative_path_to_entry
			}

			// output indentation
			for(var index = 0; index < current_depth; index++) {
				output += this._replace_tags(this.options.indent_html, context)
			}

			// output directory prefix if applicable
			if (data.type == 'directory') {

				// assemble absolute path
				absolute_path = this.base_path + '/'
				absolute_path += relative_path_to_entry
				absolute_path += entry

				context['state'] = (this._directory_should_be_traversed(absolute_path)) ? 'open' : 'closed'

				output += this._render_directory_prefix(current_path, entry, context)

				context.state = true ? 'open' : 'closed' // implement directory state here
			}

			// output entry name
			output += entry

			if (data.type == 'directory') {

				// output directory suffix and line break, if applicable
				output += this._replace_tags(this.options.directory_suffix_html, context)
					 + this._replace_tags(this.options.break_html, context)

				// output rendering of directory's entries, if applicable
				if (data.children && this._directory_should_be_traversed(absolute_path)) {

					output += this.render_directory_hash(
						data.children,
						current_depth + 1,
						current_path + entry + '/'
					)
				}
			}
			else {
			// output line break if not a directory

				output += this._replace_tags(this.options.break_html, context)
			}
		}

		return output
	},

	_directory_should_be_traversed:function(absolute_path) {
 
		return (this.options['default_state'] == 'open'
				&& (this.state[absolute_path] == undefined))
			|| (this.options['default_state'] == 'closed'
				&& (this.state[absolute_path] != undefined))
	},

	_check_path:function(path) {

		if (!this.is_dir(path)) throw('Path does not exist.')

		if (path.indexOf('..') != -1) throw('Path contains tomfoolery.')

		return path
	},

	_parent_relative_path:function() {

		var path_components = this.relative_path.split('/')
		path_components.pop()
		return path_components.join('/')
	},

	_replace_tags:function(text, context) {

		text = text || ''
		context = context || []

		for(var tag in context)
			text = (context[tag] != undefined)
				? text.replace(new RegExp('{' + tag + '}', 'g'), context[tag])
				: text

		text = text.replace(new RegExp('{parent}', 'g'), this._parent_relative_path)
		return text.replace(new RegExp('{script}', 'g'), __filename)
	},

	_normalize_path:function (path) {

		return (path == '/')
			? path
			: this._remove_trailing_slash(path)
	},

	_remove_trailing_slash:function(path) {

		var last_char = path[path.length - 1]

		return (last_char == '/')
			? path.substring(0, path.length - 1)
			: path
	},

	is_dir:function(path) {

		return fs.statSync(path).isDirectory()
	}
}