/**
 * Weather Response Mapper
 * Transforms different provider responses into unified format
 */

import { WEATHER_UNITS } from './config.js';

/**
 * Unified weather response structure
 * @typedef {Object} WeatherResponse
 * @property {Object} current - Current weather conditions
 * @property {string} current.temp - Temperature (formatted with unit)
 * @property {string} current.feels_like - Feels like temperature  
 * @property {number} current.humidity - Humidity percentage
 * @property {string} current.wind_speed - Wind speed (formatted with unit)
 * @property {string} current.condition - Weather condition description
 * @property {Array} hourly - 24-hour forecast (optional)
 * @property {Array} daily - 7-day forecast (optional) 
 * @property {string} issued_at - ISO timestamp when data was generated
 * @property {string} provider - Provider name
 * @property {boolean} is_stale - Whether data is stale (served from cache)
 */

/**
 * Convert temperature between Celsius and Fahrenheit
 */
export function convertTemperature(temp, fromUnit, toUnit) {
  if (fromUnit === toUnit) return temp;
  
  if (fromUnit === 'celsius' && toUnit === 'fahrenheit') {
    return (temp * 9/5) + 32;
  }
  
  if (fromUnit === 'fahrenheit' && toUnit === 'celsius') {
    return (temp - 32) * 5/9;
  }
  
  return temp;
}

/**
 * Format temperature with appropriate unit
 */
export function formatTemperature(temp, units = WEATHER_UNITS.METRIC) {
  const rounded = Math.round(temp);
  const unit = units === WEATHER_UNITS.IMPERIAL ? '°F' : '°C';
  return `${rounded}${unit}`;
}

/**
 * Format wind speed with appropriate unit
 */
export function formatWindSpeed(speed, units = WEATHER_UNITS.METRIC) {
  const rounded = Math.round(speed);
  const unit = units === WEATHER_UNITS.IMPERIAL ? 'mph' : 'km/h';
  return `${rounded} ${unit}`;
}

/**
 * Convert wind direction degrees to cardinal direction
 */
export function degreesToCardinal(degrees) {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return cardinals[index];
}

/**
 * Map Open-Meteo response to unified format
 */
export function mapOpenMeteoResponse(data, units = WEATHER_UNITS.METRIC, isStale = false) {
  const current = data.current;
  
  // Temperature conversion
  const tempC = current.temperature_2m;
  const temp = units === WEATHER_UNITS.IMPERIAL ? convertTemperature(tempC, 'celsius', 'fahrenheit') : tempC;
  
  // Wind speed conversion (Open-Meteo provides km/h)
  const windKmh = current.wind_speed_10m || 0;
  const windSpeed = units === WEATHER_UNITS.IMPERIAL ? windKmh * 0.621371 : windKmh;
  
  // Weather condition mapping
  const weatherDescriptions = {
    0: 'clear sky',
    1: 'mainly clear', 
    2: 'partly cloudy', 
    3: 'overcast',
    45: 'foggy', 
    48: 'depositing rime fog',
    51: 'light drizzle', 
    53: 'moderate drizzle', 
    55: 'dense drizzle',
    56: 'light freezing drizzle',
    57: 'dense freezing drizzle',
    61: 'slight rain', 
    63: 'moderate rain', 
    65: 'heavy rain',
    66: 'light freezing rain',
    67: 'heavy freezing rain',
    71: 'slight snow', 
    73: 'moderate snow', 
    75: 'heavy snow',
    77: 'snow grains',
    80: 'slight rain showers', 
    81: 'moderate rain showers', 
    82: 'violent rain showers',
    85: 'slight snow showers',
    86: 'heavy snow showers',
    95: 'thunderstorm', 
    96: 'thunderstorm with slight hail', 
    99: 'thunderstorm with heavy hail'
  };
  
  const weatherCode = current.weather_code || 0;
  const condition = weatherDescriptions[weatherCode] || 'partly cloudy';
  
  // Wind direction
  const windDirection = current.wind_direction_10m ? degreesToCardinal(current.wind_direction_10m) : 'variable';
  
  // Map hourly forecast (next 24 hours)
  const hourly = (data.hourly && data.hourly.time) ?
    data.hourly.time.slice(0, 24).map((time, index) => {
      const hourTemp = data.hourly.temperature_2m?.[index];
      const hourCode = data.hourly.weather_code?.[index] || 0;
      const hourCondition = weatherDescriptions[hourCode] || 'partly cloudy';

      return {
        time: time,
        temp: formatTemperature(units === WEATHER_UNITS.IMPERIAL ?
          convertTemperature(hourTemp, 'celsius', 'fahrenheit') : hourTemp, units),
        condition: hourCondition,
        rain_chance: hourCode >= 51 && hourCode <= 82 ? 'high' :
                    hourCode >= 45 && hourCode <= 48 ? 'medium' : 'low'
      };
    }) : [];

  // Map daily forecast
  const daily = (data.daily && data.daily.time) ?
    data.daily.time.map((time, index) => {
      const maxTemp = data.daily.temperature_2m_max?.[index];
      const minTemp = data.daily.temperature_2m_min?.[index];
      const dayCode = data.daily.weather_code?.[index] || 0;
      const dayCondition = weatherDescriptions[dayCode] || 'partly cloudy';

      return {
        date: time,
        temp_max: formatTemperature(units === WEATHER_UNITS.IMPERIAL ?
          convertTemperature(maxTemp, 'celsius', 'fahrenheit') : maxTemp, units),
        temp_min: formatTemperature(units === WEATHER_UNITS.IMPERIAL ?
          convertTemperature(minTemp, 'celsius', 'fahrenheit') : minTemp, units),
        condition: dayCondition,
        rain_chance: dayCode >= 51 && dayCode <= 82 ? 'high' :
                    dayCode >= 45 && dayCode <= 48 ? 'medium' : 'low'
      };
    }) : [];

  return {
    current: {
      temp: formatTemperature(temp, units),
      feels_like: formatTemperature(temp, units), // Open-Meteo doesn't provide feels_like
      humidity: current.relative_humidity_2m || 0,
      wind_speed: `${formatWindSpeed(windSpeed, units)} from the ${windDirection}`,
      condition: condition
    },
    hourly: hourly,
    daily: daily,
    issued_at: new Date().toISOString(),
    provider: 'Open-Meteo',
    is_stale: isStale
  };
}

/**
 * Map WeatherKit response to unified format
 */
export function mapWeatherKitResponse(data, units = WEATHER_UNITS.METRIC, isStale = false) {
  const current = data.currentWeather;
  
  // WeatherKit provides Celsius by default
  const tempC = current.temperature;
  const temp = units === WEATHER_UNITS.IMPERIAL ? convertTemperature(tempC, 'celsius', 'fahrenheit') : tempC;
  const feelsLikeC = current.temperatureApparent || tempC;
  const feelsLike = units === WEATHER_UNITS.IMPERIAL ? convertTemperature(feelsLikeC, 'celsius', 'fahrenheit') : feelsLikeC;
  
  // Wind speed (WeatherKit provides m/s)
  const windMs = current.windSpeed || 0;
  const windSpeed = units === WEATHER_UNITS.IMPERIAL ? windMs * 2.237 : windMs * 3.6; // mph or km/h
  
  const windDirection = current.windDirection ? degreesToCardinal(current.windDirection) : 'variable';
  
  return {
    current: {
      temp: formatTemperature(temp, units),
      feels_like: formatTemperature(feelsLike, units),
      humidity: Math.round((current.humidity || 0) * 100),
      wind_speed: `${formatWindSpeed(windSpeed, units)} from the ${windDirection}`,
      condition: current.conditionCode || 'partly cloudy'
    },
    hourly: [], // TODO: Map hourly data if available
    daily: [],  // TODO: Map daily data if available  
    issued_at: current.asOf || new Date().toISOString(),
    provider: 'WeatherKit',
    is_stale: isStale
  };
}

/**
 * Map OpenWeather response to unified format
 */
export function mapOpenWeatherResponse(data, units = WEATHER_UNITS.METRIC, isStale = false) {
  const current = data.current;
  
  // OpenWeather temperature (already in requested units)
  const temp = current.temp;
  const feelsLike = current.feels_like;
  
  // Wind speed (OpenWeather provides m/s by default)
  const windMs = current.wind_speed || 0;
  const windSpeed = units === WEATHER_UNITS.IMPERIAL ? windMs * 2.237 : windMs * 3.6; // mph or km/h
  
  const windDirection = current.wind_deg ? degreesToCardinal(current.wind_deg) : 'variable';
  
  return {
    current: {
      temp: formatTemperature(temp, units),
      feels_like: formatTemperature(feelsLike, units),
      humidity: current.humidity || 0,
      wind_speed: `${formatWindSpeed(windSpeed, units)} from the ${windDirection}`,
      condition: current.weather?.[0]?.description || 'partly cloudy'
    },
    hourly: [], // TODO: Map hourly data if available
    daily: [],  // TODO: Map daily data if available
    issued_at: new Date(current.dt * 1000).toISOString(),
    provider: 'OpenWeather',
    is_stale: isStale
  };
}

/**
 * Create error response in unified format
 */
export function createErrorResponse(error, provider = 'Unknown', isStale = false) {
  return {
    current: {
      temp: 'N/A',
      feels_like: 'N/A',
      humidity: 0,
      wind_speed: 'N/A',
      condition: 'data unavailable'
    },
    hourly: [],
    daily: [],
    issued_at: new Date().toISOString(),
    provider: provider,
    is_stale: isStale,
    error: error
  };
}