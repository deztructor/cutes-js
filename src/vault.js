/*
 * Backup tool
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

qtscript.use("qt.core")
qtscript.eval("sys.js")
qtscript.eval("os.js")
qtscript.eval("subprocess.js")
qtscript.eval("json2.js")
qtscript.eval("util.js")

var os = lib.os
var sys = lib.sys
var subprocess = lib.subprocess
var util = lib.util

var debug = (function() {
    return Object.create({ rethrow : function(err) { throw err }})
})();

Date.prototype.toGitTag = function() {
    return this.toISOString().replace(/:/g, '-')
};

var mk_git = function(storage_path) {
    var p = subprocess.process({ cwd : storage_path })

    var execute = function(cmd, params, can_fail) {
        print("git", cmd, params);
        var fn = can_fail ? p.call : p.check_call
        return fn('git', params ? [cmd].concat(params) : [cmd])
    };

    var rename_ops = { "R" : "R", "C" : "C" };

    var status_item = {
        is_clean : function() { return (this.index == ' '
                                        && this.tree == ' ') },
        is_tree_clean : function() { return this.tree == ' ' },
        toString : function() {
            return this.index + this.tree + ' ' + this.src
        }
    }

    var parse_status = function(items) {
        var res = [];
        for (var i = 0; i < items.length; ++i) {
            var s = String(items[i]);
            if (s.length < 1)
                continue;
            if (s.length < 4 && s[2] != " ")
                throw lib.error({ msg : "Unexpected status format, need XX ...",
                                  format : s });
            var item = Object.create(status_item)
            item.index = s[0]
            item.tree = s[1]
            item.src = s.substr(3)
            if (rename_ops[item.index] || rename_ops[item.tree]) {
                ++i;
                if (i == items.length)
                    throw lib.error({ msg : "No dst after rename op",
                                      format : s});
                item.dst = items[i];
            }
            res.push(item);
        }
        return res;
    };

    var status = function(path, can_fail) {
        var params = ["-z"];
        if (path && path != "")
            params = params.concat(["--", path]);
        var rc = execute('status', params, can_fail);
        if (!rc)
            return parse_status(p.stdout().split("\0"));
        else
            return rc;
    }

    var add = function(path, params, can_fail) {
        params = params || []
        return execute('add', params.concat([path]), can_fail)
    }

    var commit = function(msg, params, can_fail) {
        params = params || []
        return execute('commit', params.concat(['-m', msg]), can_fail)
    }

    var config = function(values, can_fail) {
        var rc;
        for (var k in values) {
            rc = execute('config', [k, values[k]], can_fail);
            if (rc)
                return rc;
        };
        return 0;
    };

    var basic_cmd = function(name) {
        return function(params, can_fail) {
            return execute(name, params, can_fail);
        };
    };

    var exec_stdout = function(name, params, can_fail) {
        if (params === undefined)
            params = []
        if (typeof params !== 'array')
            throw lib.error({msg : "invalid param, need array",
                             param : params})
        var rc = execute(name, [].slice.call(arguments), can_fail);
        if (!rc)
            return p.stdout();
        
        return undefined;
    };

    var cmd_basic_result = function(name) {
        return function(params, can_fail) {
            return exec_stdout(name, params, can_fail);
        }
    };

    var getline = function() {
        var rc = execute.apply(null, [].slice.call(arguments));
        return ((!rc)
                ? p.stdout().split('\n')[0].toString().trim()
                : undefined);
    }

    var hash_object = function(path) {
        return getline('hash-object', [path]);
    };

    var rev_parse = function(rev) {
        return getline('rev-parse', [rev]);
    };

    var tag = function(params, can_fail) {
        return execute('tag', params || [], can_fail)
    };

    var checkout = function(params, can_fail) {
        return execute('checkout', params || [], can_fail)
    };

    return {
        status : status,
        config : config,
        add: add,
        commit : commit,
        init : basic_cmd('init'),
        reset : basic_cmd('reset'),
        clean : basic_cmd('clean'),
        hash_object : hash_object,
        rev_parse : rev_parse,
        tag : tag,
        checkout : checkout,
        returncode : function() { return p.returncode(); },
        stdout : function() { return p.stdout(); },
        stderr : function() { return p.stderr(); },
        path : function() { return storage_path }
    };
};

var mk_vault = function(path) {

    var git = mk_git(path);
    var storage = new QDir(os.path(path,".git"));

    var init = function(config) {
        if (!os.mkdir(path))
            throw lib.error({ msg : "Can't init vault", path : path,
                              reason : "directory already exists" });

        try {
            if (git.init())
                throw lib.error({ msg : "Can't init git", path : path,
                                  stderr : git.stderr()})
            if (!storage.exists())
                throw lib.error({ msg : "Can't find .git", path : path,
                                  stderr : git.stderr()})
            git.config(config);
            var anchor_file = os.path(path, '.vault')
            os.write_file(anchor_file, sys.date().toGitTag())
            git.add(anchor_file)
            git.commit('anchor')
            git.tag(['anchor'])
        } catch (err) {
            subprocess.call("rm", ["-rf", path]);
            throw err;
        }
    };

    var is_clean = function(status) {
        return lib.util.first(status, function() {
                return !this.is_clean
            }) < status.length
    }


    var start_time;

    var status_dump = function(status) {
        return util.map(status, function() {
            return this.toString()
        }).join(', ')
    }

    var module = function(name, config, options) {
        var root_dir = os.path(git.path(), name)
        var data_dir = os.path(root_dir, "data")
        var blobs_dir = os.path(root_dir, "blobs")
        var blobs_rel = os.path(name, "blobs")
        var mkdir = os.mkdir;
        var args = {'--dir' : data_dir,
                    '--bin-dir' : blobs_dir,
                    '--home-dir' : options.home }

        var exec_script = function() {
            var arglist = [];
            for (var arg in args) {
                arglist.push([arg, args[arg]].join('='))
            }
            var p = subprocess.popen(config.script, arglist)
            p.waitForFinished()
            if (p.exitCode())
                throw lib.error({ module : name,
                                  script : config.script,
                                  args : arglist,
                                  rc : p.exitCode(),
                                  stdout : p.readAllStandardOutput(),
                                  stderr : p.readAllStandardError()});
            print(p.readAllStandardOutput(), p.readAllStandardError());
        }

        var save_blob = function(item) {
            var git_path = item.src
            var sha = git.hash_object(git_path);
            var that = { root : os.path(git.path(), '.git', 'blobs'),
                         prefix : sha.slice(0, 2),
                         id : sha.slice(2) }
            print("ID ", that.id)
            mkdir(that.root)
            var blob_dir = os.path(that.root, that.prefix)
            mkdir(blob_dir)
            var blob_fname = os.path(blob_dir, that.id)
            var link_fname = os.path(git.path(), git_path)
            if (os.path.isfile(blob_fname)) {
                print("unlink")
                os.unlink(link_fname)
            } else {
                print("rename")
                os.rename(link_fname, blob_fname)
            }
            os.symlink(os.path.relative(blob_fname, os.path.dirname(link_fname)),
                       link_fname)
            return that;
        }

        var restore = function() {
            args['--action'] = 'import'
            exec_script()
        }

        var backup = function() {
            args['--action'] = 'export'
            os.rmtree(data_dir);
            os.rmtree(blobs_dir);

            mkdir(root_dir);
            mkdir(data_dir);
            mkdir(blobs_dir);
            exec_script()

            var status, i;
            status = git.status(blobs_rel);
            for (i = 0; i < status.length; ++i)
                save_blob(status[i]);

            // commit data
            status = git.status(root_dir)
            if (status.length) {
                git.add(root_dir, ['-A']);
                status = git.status(root_dir);
                if (util.first(status, function() {
                    return !this.is_tree_clean()
                }) < status.length)
                    throw lib.error({msg : "Dirty tree",
                                     dir : root_dir,
                                     status : status_dump(status) })
                
                git.commit(name + " " + start_time.toGitTag());

                status = git.status(root_dir)
                if (util.first(status, function() {
                    return !this.is_clean()
                }) < status.length)
                    throw lib.error({msg : "dirty",
                                     dir : root_dir,
                                     status : status_dump(status)})
            }

        };
        return { backup : backup, restore : restore }
    }

    var backup = function(config, options) {
        start_time = sys.date()
        var head = git.rev_parse('master')
        var res = { succeeded :[], failed : [] }
        var head_before_module = head
        for (var name in config) {
            try {
                module(name, config[name], options).backup()
                res.succeeded.push(name)
                head_before_module = git.rev_parse('master')
            } catch (err) {
                err.module = name
                print("Failed to backup " + name + ", reason: " + err.toString())
                res.failed.push(name)
                // rollback
                git.reset(['--hard', head_before_module], true)
                git.clean(['-fd'])
                debug.rethrow(err)
            }
        }
        git.tag([start_time.toGitTag()])
        return res;
    };

    var restore = function(config, options) {
        var res = { succeeded :[], failed : [] }

        var restore_or_rollback = function (name) {
            try {
                module(name, config[name], options).restore()
                res.succeeded.push(name);
            } catch (err) {
                err.module = name
                print("Failed to restore " + name + ", reason: " + err.toString());
                res.failed.push(name);
                debug.rethrow(err);
            }
        }

        try {
            git.checkout([options.tag])
            for (var name in config)
                restore_or_rollback(name)
        } finally {
            git.checkout(['master'])
        }
    }

    return Object.create({
        init : init,
        backup : backup,
        restore : restore
    });
};

var parse_git_config = function(cfg) {
    var res = {"status.showUntrackedFiles" : "all"};
    if (cfg) {
            var pairs = cfg.split(',');
        for (var i = 0; i < pairs.length; ++i) {
            var kv = pairs[i].split('=');
            if (kv.length == 2 && kv[0].length)
                res[kv[0]] = kv[1];
        }
    }
    return res;
};

(function() {
    var cmdline = lib.sys.optarg(qtscript.script.args, {
        V : { name : "vault", has_param : true, required : true },
        H : { name : "home", has_param : true },
        g : { name : "git_cfg", has_param : true },
        a : { name : "action", has_param : true, required : true },
        c : { name : "config_path", has_param : true },
        m : { name : "message", has_param : true},
        t : { name : "tag", has_param : true }
    });

    var vault = mk_vault(cmdline.opts.vault);
    var action = cmdline.opts.action;

    var modules_config = function() {
        var config = cmdline.opts.config_path;
        if (!config)
            throw lib.error({ msg : "Need config", action : action });
        return JSON.parse(os.read_file(config));
    };
    switch (action) {
      case 'init':
        vault.init(parse_git_config(cmdline.opts.git_cfg));
        break;
      case 'backup':
        vault.backup(modules_config(), cmdline.opts);
        break;
      case 'restore':
        vault.restore(modules_config(), cmdline.opts);
        break;
    default:
        throw lib.error({ msg : "Unknown action", action : action});
        break;
    }
    return "";
}).call(this);
