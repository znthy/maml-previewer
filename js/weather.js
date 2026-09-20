import { Engine, BUILTINS } from './engine.js';

import { NULLV } from './utils.js';

Engine.weatherValueFor = function(varName) {
  if (!this.sim.weatherSim) return NULLV;
  const col = (this.contentProviderVarColumn.get(varName) || '').toLowerCase();
  if (col.includes('city')) return this.sim.wCity;
  if (col.includes('day_temp')) return this.sim.wHigh;
  if (col.includes('night_temp')) return this.sim.wLow;
  if (col.includes('current_temp') || col.includes('temp')) return this.sim.wTemp;
  if (col.includes('current_weather') || col.includes('weather_id') || col.includes('condition')) return this.sim.wCond;
  return this.sim.wCond;
};

Object.assign(BUILTINS, {
  weather_city: () => Engine.sim.weatherSim ? Engine.sim.wCity : '',
  weather_condition: () => Engine.sim.weatherSim ? Engine.sim.wCond : '',
  weather_cur_temp: () => Engine.sim.weatherSim ? Engine.sim.wTemp : NULLV,
  weather_high_temp: () => Engine.sim.weatherSim ? Engine.sim.wHigh : NULLV,
  weather_low_temp: () => Engine.sim.weatherSim ? Engine.sim.wLow : NULLV,
  weather_wind_pow: () => '3',
  weather_wind_dir: () => 'N',
  weather_sunrise: () => '06:20',
  weather_sunset: () => '18:40'
});

document.getElementById('weatherSim').addEventListener('change', e => Engine.sim.weatherSim = e.target.checked);

document.getElementById('wCity').addEventListener('input', e => Engine.sim.wCity = e.target.value);

document.getElementById('wCond').addEventListener('input', e => Engine.sim.wCond = e.target.value);

document.getElementById('wTemp').addEventListener('input', e => Engine.sim.wTemp = parseFloat(e.target.value) || 0);

document.getElementById('wHigh').addEventListener('input', e => Engine.sim.wHigh = parseFloat(e.target.value) || 0);

document.getElementById('wLow').addEventListener('input', e => Engine.sim.wLow = parseFloat(e.target.value) || 0);
