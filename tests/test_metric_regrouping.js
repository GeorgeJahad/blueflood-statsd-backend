
var fs = require('fs');
var metric_utils = require('../lib/metric_utils');

var parsedObj;

function checkSameCounter(assert, counter, longName) {
  assert.strictEqual(parsedObj.counters[longName], counter.value);
  assert.strictEqual(parsedObj.counter_rates[longName], counter.rate);  
}

function checkSameGauge(assert, gauge, longName) {
  assert.strictEqual(parsedObj.gauges[longName], gauge.value);
}

function checkSameTimer(assert, timer, longName) {
  var foundPercentiles = false;
  assert.strictEqual(parsedObj.timer_data[longName].count, timer.count);
  assert.strictEqual(parsedObj.timer_data[longName].count_ps, timer.rate);
  assert.strictEqual(parsedObj.timer_data[longName].lower, timer.min);
  assert.strictEqual(parsedObj.timer_data[longName].upper, timer.max);
  assert.strictEqual(parsedObj.timer_data[longName].mean, timer.avg);
  assert.strictEqual(parsedObj.timer_data[longName].median, timer.median);
  assert.strictEqual(parsedObj.timer_data[longName].std, timer.std);
  assert.ok(parsedObj.hasOwnProperty('pctThreshold') && parsedObj.pctThreshold.length > 0);
  assert.ok(timer.hasOwnProperty('percentiles'));
  // there should be one for each of pctThreshold, except for 999, which usually gets cut for being incomplete.
  assert.ok(parsedObj.pctThreshold.length - Object.keys(timer.percentiles).length <= 1);
  
  Object.keys(timer.percentiles).forEach(function(percentile) {
    assert.strictEqual(parsedObj.timer_data[longName]['mean_' + percentile], timer.percentiles[percentile].avg);
    assert.strictEqual(parsedObj.timer_data[longName]['upper_' + percentile], timer.percentiles[percentile].max);
    assert.strictEqual(parsedObj.timer_data[longName]['sum_' + percentile], timer.percentiles[percentile].sum);
    foundPercentiles = true;
  });
  assert.ok(foundPercentiles);
}

function checkSameSet(assert, set, longName) {
  var values = Object.keys(parsedObj.sets[longName].store);
  values.sort();
  set.values.sort();
  assert.ok(values.length > 0);
  assert.deepEqual(values, set.values);
}

exports['setUp'] = function(test, assert) {
  parsedObj = JSON.parse(fs.readFileSync('tests/metrics_bundle.json'));
  assert.ok(parsedObj);
  test.finish();
}

exports['test_counters'] = function(test, assert) {
  var counters = metric_utils.extractCounters(parsedObj),
      names = ['internal.bad_lines_seen', 'internal.packets_received', '3333333.C1s', '3333333.C200ms', '4444444.C10s', '3333333.C29s'],
      visitCount = 0;
  
  assert.strictEqual(6, Object.keys(counters).length);
  assert.strictEqual(0, visitCount);
  
  // ensure all the values were copied across.
  names.forEach(function(key) {
    checkSameCounter(assert, counters[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(6, visitCount);
  
  test.finish();
}

exports['test_gauges'] = function(test, assert) {
  var gauges = metric_utils.extractGauges(parsedObj),
      names = ['3333333.G1s', '4444444.G200ms', '3333333.G10s', 'internal.timestamp_lag'],
      visitCount = 0;
  
  assert.strictEqual(4, Object.keys(gauges).length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameGauge(assert, gauges[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(4, visitCount);
  
  test.finish();
}

exports['test_sets'] = function(test, assert) {
  var sets = metric_utils.extractSets(parsedObj),
      names = ['4444444.S1s', '3333333.S500ms'],
      visitCount = 0;
  
  assert.strictEqual(2, Object.keys(sets).length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameSet(assert, sets[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(2, visitCount);
  
  test.finish();
}

exports['test_timers'] = function(test, assert) {
  var timers = metric_utils.extractTimers(parsedObj),
      names = ['4444444.T1s',  '3333333.T200ms', '3333333.T10s', '3333333.T29s'],
      visitCount = 0;
  
  assert.ok(parsedObj.hasOwnProperty('pctThreshold'));
  assert.strictEqual(5, parsedObj.pctThreshold.length);
  assert.strictEqual(4, Object.keys(timers).length);
  assert.strictEqual(0, visitCount);
  
  names.forEach(function(key) {
    checkSameTimer(assert, timers[key], key);
    visitCount += 1;
  });
  
  assert.strictEqual(visitCount, 4);
  
  test.finish();
}

exports['test_grouping_by_parsed_tenant'] = function(test, assert) {
  var tenantMap = metric_utils.groupMetricsByTenant(parsedObj),
      tenants = ['3333333', '4444444', 'internal'];
  
  assert.strictEqual(3, Object.keys(tenantMap).length);
  tenants.forEach(function(tenantId) {
    assert.ok(tenantMap.hasOwnProperty(tenantId));
  });
  
  assert.ok(tenantMap['3333333'].counters.hasOwnProperty('C1s'));
  assert.ok(tenantMap['3333333'].counters.hasOwnProperty('C200ms'));
  assert.ok(tenantMap['3333333'].counters.hasOwnProperty('C29s'));
  assert.ok(tenantMap['4444444'].counters.hasOwnProperty('C10s'));
  assert.ok(tenantMap['internal'].counters.hasOwnProperty('bad_lines_seen'));
  assert.ok(tenantMap['internal'].counters.hasOwnProperty('packets_received'));
  
  checkSameCounter(assert, tenantMap['3333333'].counters['C1s'], '3333333.C1s');
  checkSameCounter(assert, tenantMap['3333333'].counters['C200ms'], '3333333.C200ms');
  checkSameCounter(assert, tenantMap['3333333'].counters['C29s'], '3333333.C29s');
  checkSameCounter(assert, tenantMap['4444444'].counters['C10s'], '4444444.C10s');
  checkSameCounter(assert, tenantMap['internal'].counters['bad_lines_seen'], 'internal.bad_lines_seen');
  checkSameCounter(assert, tenantMap['internal'].counters['packets_received'], 'internal.packets_received');
  
  assert.ok(tenantMap['3333333'].gauges.hasOwnProperty('G1s'));
  assert.ok(tenantMap['3333333'].gauges.hasOwnProperty('G10s'));
  assert.ok(tenantMap['4444444'].gauges.hasOwnProperty('G200ms'));
  assert.ok(tenantMap['internal'].gauges.hasOwnProperty('timestamp_lag'));
  
  checkSameGauge(assert, tenantMap['3333333'].gauges['G1s'], '3333333.G1s');
  checkSameGauge(assert, tenantMap['3333333'].gauges['G10s'], '3333333.G10s');
  checkSameGauge(assert, tenantMap['4444444'].gauges['G200ms'], '4444444.G200ms');
  checkSameGauge(assert, tenantMap['internal'].gauges['timestamp_lag'], 'internal.timestamp_lag');
  
  assert.ok(tenantMap['4444444'].timers.hasOwnProperty('T1s'));
  assert.ok(tenantMap['3333333'].timers.hasOwnProperty('T200ms'));
  assert.ok(tenantMap['3333333'].timers.hasOwnProperty('T10s'));
  assert.ok(tenantMap['3333333'].timers.hasOwnProperty('T29s'));
  
  checkSameTimer(assert, tenantMap['4444444'].timers['T1s'], '4444444.T1s');
  checkSameTimer(assert, tenantMap['3333333'].timers['T200ms'], '3333333.T200ms');
  checkSameTimer(assert, tenantMap['3333333'].timers['T10s'], '3333333.T10s');
  checkSameTimer(assert, tenantMap['3333333'].timers['T29s'], '3333333.T29s');
  
  assert.ok(tenantMap['4444444'].sets.hasOwnProperty('S1s'));
  assert.ok(tenantMap['3333333'].sets.hasOwnProperty('S500ms'));
  
  checkSameSet(assert, tenantMap['4444444'].sets['S1s'], '4444444.S1s');
  checkSameSet(assert, tenantMap['3333333'].sets['S500ms'], '3333333.S500ms');
  
  test.finish();
}

exports['test_specific_histogram_extraction'] = function(test, assert) {
  // 4444444.T1s should only have four bins.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['4444444'],
      timer;
  
  assert.ok(tenantInfo.hasOwnProperty('timers'));
  assert.ok(tenantInfo.timers.hasOwnProperty('T1s'));
  
  timer = tenantInfo.timers.T1s;
  
  assert.ok(timer.hasOwnProperty('histogram'));
  assert.deepEqual(['bin_100', 'bin_250', 'bin_500', 'bin_inf'], Object.keys(timer.histogram));
  
  test.finish();
}

exports['test_specific_histogram_exclusion'] = function(test, assert) {
  // 3333333.T10s should have no histogram.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['3333333'],
      timer;
  
  assert.ok(tenantInfo.hasOwnProperty('timers'));
  assert.ok(tenantInfo.timers.hasOwnProperty('T10s'));
    
  timer = tenantInfo.timers.T10s;
  
  assert.ok(!timer.hasOwnProperty('histogram'));
  
  test.finish();
}

exports['test_catch_all_histogram_extraction'] = function(test, assert) {
  // '3333333.T200ms', '3333333.T29s' should have 11 bins.
  var tenantInfo = metric_utils.groupMetricsByTenant(parsedObj)['3333333'],
      timers = ['T200ms', 'T29s'],
      visitCount = 0;
  
  assert.ok(tenantInfo.hasOwnProperty('timers'));
  
  timers.forEach(function(timerName) {
    assert.ok(tenantInfo.timers.hasOwnProperty(timerName));
    assert.strictEqual(11, Object.keys(tenantInfo.timers[timerName].histogram).length);
    visitCount += 1;
  });
  
  assert.strictEqual(2, visitCount);
  
  test.finish();
}