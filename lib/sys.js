/*
 * System utilities
 *
 * Copyright (C) 2012, 2013 Jolla Ltd.
 * Contact: Denis Zalevskiy <denis.zalevskiy@jollamobile.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.

 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.

 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
 * 02110-1301 USA
 *
 * http://www.gnu.org/licenses/old-licenses/lgpl-2.1.html
 */

var util = require('util');
var error = require('error');

var options = function(data) {
    var that = { info : data }
    var short_ = {}
    var long_ = {}

    var cache_options = function() {
        for (var name in data) {
            var info = data[name]
            var pseudonym = info.short_
            if (pseudonym)
                short_[pseudonym] = name
            pseudonym = info.long_
            if (pseudonym)
                long_[pseudonym] = name
        }
    }
    cache_options()

    var help = function(argv) {
        var cmd = (argv && argv.length) ? argv[0] : "argv???";
        var lines = ["Usage: " + cmd + " <options> <params>"]
        for (var name in data) {
            var items = []
            var v = data[name]
            var param = v.has_param ? ("<" + name + ">") : ""
            var p = v.short_
            if (p)
                items.push("-" + p + " " + param)
            p = v.long_
            if (p)
                items.push("--" + p + (v.has_param ? ("=" + param) : ""))
            lines.push("\t" + items.join(', '))
        }
        print(lines.join('\n'));
    }

    var parse = function(argv) {
        if (!argv || argv.length == undefined)
            error.raise({msg : "Unexpected or undefined getopt parameter", param : argv});
        var params = []
        var opts = {}
        var i
        var delim

        var get_long = function(i, name) {
            var value = true
            var div_pos = name.indexOf("=")
            var var_name
            var info

            if (div_pos === 0)
                error.raise({msg : '"=" can not be an long option name '})

            if (div_pos >= 0) {
                value = name.substr(div_pos + 1)
                name = name.substr(0, div_pos)
            }
            var_name = long_[name]
            if (var_name === undefined)
                error.raise({msg : "Unknown long option", option : name })

            info = that.info[var_name]
            if (info.has_param) {
                if (div_pos < 0) {
                    if (++i >= argv.length)
                        error.raise({ msg : "Expected option data", option : name});

                    value = argv[i]
                    if (value[0] == '-')
                        error.raise({ msg: "Expected value, not option", option : name,
                                          next : value });
                }
            } else {
                if (div_pos >= 0)
                    error.raise({msg : "Option should not have a value",
                                     option : name, value : value})
            }
            opts[var_name] = value
            return i
        }

        var get_short = function(i, name) {
            var value, info
            var var_name = short_[name]
            if (name === undefined)
                error.raise({msg : "Unknown short option", option : name })
            value = true
            info = that.info[var_name]
            if (info.has_param) {
                if (++i >= argv.length)
                    error.raise({ msg : "Expected option data", option : name});

                value = argv[i]
                if (value[0] == '-')
                    error.raise({ msg: "Expected value, not option", option : name,
                                      next : value });
            }
            opts[var_name] = value
            return i
        }

        var getopt = function(i, a) {
            if (a[1] == '-') {
                i = get_long(i, a.substr(2))
            } else if (a.length == 2) {
                i = get_short(i, a[1]);
            } else {
                error.raise({msg : "Invalid option format", option : a })
            }
            return i
        }

        var check_required = function() {
            var name, v
            for (name in that.info) {
                v = that.info[name]
                if (v.required && !(name in opts)) {
                    error.raise({msg : "Option is required", option : name});
                }
            }
        }

        var set_default = function() {
            data.each(function(name, info) {
                var v = info.default_;
                if (v !== undefined) {
                    if (typeof v === 'function')
                        opts[name] = info.default_();
                    else
                        opts[name] = info.default_;
                }
            });
        };

        var main = function() {
            var i, a
            for (i = 0; i < argv.length; ++i) {
                a = argv[i]
                if (a.length >= 2 && a[0] == '-') {
                    i = getopt(i, a)
                } else {
                    params.push(a)
                }
            }
        };

        set_default();
        main();
        check_required();

        that.opts = opts
        that.params = params
        return that
    }

    that.parse = function(argv) {
        try {
            return parse(argv)
        } catch (err) {
            help(argv)
            throw err
        }
    }
    return that
};

var command_line_options = function(options, short_options, long_options
                                    , options_has_param)
{
    var cmd_options = [];

    short_options = short_options || {};
    long_options = long_options || {};
    options_has_param = options_has_param || {};

    util.eachProperty(options, function(n, v) {
        var opt = short_options[n];
        if (opt !== undefined) {
            if (options_has_param[n]) {
                cmd_options = cmd_options.concat([["-", opt].join(""), v]);
            } else {
                if (v)
                    cmd_options.push(["-", opt].join(""));
            }
            return;
        }
        opt = long_options[n];
        if (opt !== undefined) {
            if (options_has_param[n]) {
                cmd_options.push(["--", opt, "=", v].join(""));
            } else {
                if (v)
                    cmd_options.push(["--", opt].join(""));
            }
        }
    });
    return cmd_options;
};



exports = Object.create({
    getopt : options,
    date : function() { return new Date() },
    command_line_options: command_line_options
})
