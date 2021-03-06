"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const gourmet_api_1 = require("gourmet-api");
const moment = require("moment");
const path = require("path");
const cache_1 = require("./cache");
const config_1 = require("./config");
const renderer_1 = require("./renderer");
const api = new gourmet_api_1.GourmetAPI();
const config = config_1.readConfig();
const cache = new cache_1.Cache(config);
cache.readCache();
(async () => {
    const changes = await fetchMeals();
    const data = {
        version: getCurrentVersion(),
        fetchTime: moment().toISOString(),
        changes,
        data: map(cache.data)
    };
    renderer_1.render(config, data);
})();
async function fetchMeals() {
    await api.login(config.username, config.password);
    const list = await api.getMealList(true);
    const newMeals = [];
    const changes = list.reduce((ch, meal) => {
        const cached = cache.data[meal.id];
        if (!cached) {
            newMeals.push(meal);
        }
        else if (cached.available !== meal.available) {
            if (meal.available) {
                ch.available.push(Object.assign({}, cached));
            }
            else {
                ch.unavailable.push(Object.assign({}, cached));
            }
            cached.available = meal.available;
        }
        return ch;
    }, emptyChanges());
    if (newMeals.length > 0) {
        console.log(`Filling cache with ${newMeals.length} new meals...`);
    }
    let count = 0;
    const cacheFill = newMeals
        .map(it => api.getMealDetail(it.id)
        .then(res => {
        cache.data[res.id] = res;
        changes.new.push(res);
        count++;
        console.log(`${count}/${newMeals.length}`);
    }));
    await Promise.all(cacheFill);
    cache.saveCache();
    return changes;
}
function getCurrentVersion() {
    const file = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8');
    return JSON.parse(file)['version'];
}
function emptyChanges() {
    return {
        available: [],
        unavailable: [],
        new: []
    };
}
function map(obj) {
    return Object.keys(obj).map(key => obj[key]);
}
