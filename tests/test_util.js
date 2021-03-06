var config = require('config');
config.document = true;
var test = require('test');
var util = require("util");

var fixture = test.fixture();

fixture.addTest('array_each', function() {
    var s = "";
    ['a', 'b', 'c'].each(function(v) {
        s += v;
    });
    test.equal(s, 'abc');
});

fixture.addTest('object_each', function() {
    var s = "";
    var obj = { a : 1, b : 2, c : 3 };
    obj.each(function(name, value) {
        s += (name + String(value));
    });
    test.equal(s, 'a1b2c3');
});

fixture.addTest('cons', function() {
    test.deepEqual(util.cons(), []);
    test.deepEqual(util.cons(1), [1]);
    test.deepEqual(util.cons(1, [2, 3]), [1, 2, 3]);
    test.deepEqual(util.cons([1, 2]), [[1, 2]]);
    test.deepEqual(util.cons([1, 2], [3, 4]), [[1, 2], 3, 4]);
    test.deepEqual(util.cons(1, [2, 3, 4], [5, 6]), [1, 2, 3, 4]);
});

fixture.addTest('map', function() {
    test.deepEqual(util.map([], function(v) { return v; }), []);
    test.deepEqual(util.map([1, 2, 3], function(v) { return v + 1; })
                   , [2, 3, 4]);
});

fixture.addTest('extract', function() {
    test.deepEqual(util.extract([], function(v) { return; }), []);
    test.deepEqual(util.extract([1, 2, 3], function(v) { return; }), []);
    test.deepEqual(util.extract([1, 2, 3], function(v) { return v + 1; })
                   , [2, 3, 4]);
    test.deepEqual(util.extract([1, 2, 3], function(v) {
        return (v > 1) ? v : undefined;
    }), [2, 3]);
});

fixture.addTest('filter', function() {
    test.deepEqual(util.filter([], function(v) { return true; }), []);
    test.deepEqual(util.filter([], function(v) { return false; }), []);
    test.deepEqual(util.filter([1, 2, 3, 4]
                               , function(v) { return v % 2; })
                   , [1, 3]);
    test.deepEqual(util.filter([1, 2, 3, 4]
                               , function(v) { return !(v % 2); })
                   , [2, 4]);
});

fixture.addTest('first', function() {
    var is2 = function(v) { return v === 2; };
    test.equal(util.first([], is2), 0);
    test.equal(util.first([1, 2, 3, 2] , is2), 1);
    test.equal(util.first([1, 2, 3, 2], is2, 0), 1);
    test.equal(util.first([1, 2, 3, 2], is2, 1), 1);
    test.equal(util.first([1, 2, 3, 2], is2, 2), 3);
    test.equal(util.first([1, 1, 3, 3], is2), 4);
    test.equal(util.first([1, 1, 3, 3], is2, 2), 4);
    test.equal(util.first([1, 1, 3, 3], is2, 5), 5);
});

fixture.addTest('curry', function() {
    var plus = function(x, y) { return x + y; };
    var plus1 = plus.curry(1);
    var plus2 = plus.curry(2);
    test.equal(plus1(1), 2);
    test.equal(plus2(1), 3);

    // several values to be curried
    var in_range = function(x, y, v) { return (x <= v) && (v <= y); };
    var gt2 = in_range.curry(2);
    test.equal(gt2(4, 3), true);
    test.equal(gt2(4, 5), false, "outside");
    test.equal(gt2(4, 1), false);
});

fixture.addTest('stream', function() {
    var a0 = []
    , a1 = [1]
    , a2 = [1, 2, 3, 2];
    var s;
    s = util.stream(a0);
    test.equal(s.end(), true);
    test.deepEqual(s.map(function(s) { return s.next() + 1; }), []);
    a0.push(1);
    test.equal(s.end(), false);
    test.deepEqual(s.map(function(s) { return s.next() + 1; }), [2]);
});

fixture.addTest('numbers', function() {
    test.ok("1234".isDecimal(), "Decimal");
    test.ok("-1234".isDecimal(), "Negative decimal");
    test.ok("+1234".isDecimal(), "Positive decimal");
    test.ok(!("1234f".isDecimal()), "Not decimal");
});

fixture.addTest('zip', function() {
    var s1 = [], s2 = [];
    test.deepEqual(util.zip(s1, s2), []);
    s1 = [1]; s2 = [];
    test.deepEqual(util.zip(s1, s2), [[1, undefined]]);
    s1 = [1]; s2 = [2];
    test.deepEqual(util.zip(s1, s2), [[1, 2]]);
    s1 = [1]; s2 = [2, 3];
    test.deepEqual(util.zip(s1, s2), [[1, 2]]);
    s1 = [1, 3]; s2 = [2, 4];
    test.deepEqual(util.zip(s1, s2), [[1, 2], [3, 4]]);
    s1 = [1, 3]; s2 = [2, 4], s3 = [5, 6];
    test.deepEqual(util.zip(s1, s2, s3), [[1, 2, 5], [3, 4, 6]]);
});

fixture.addTest('doc', function() {
    var fn = util.doc(function(a) { return 0; }
                      , { params: { a: "Some param" }, returns: "zero" });
    test.notEqual(fn.__doc__, undefined, "Should has __doc__");
    var doc = util.help(fn);
    // TODO
});

fixture.addTest('mapObject', function() {
    var res;
    var toStr = function(key, value) {
        return String(key) + "," + value;
    };
    res = util.mapObject({}, toStr);
    test.deepEqual(res, []);

    res = util.mapObject({x:1}, toStr);
    test.deepEqual(res, ["x,1"]);

    res = util.mapObject({x:1, y:3}, toStr);
    res.sort();
    test.deepEqual(res, ["x,1", "y,3"]);
});

fixture.execute();
