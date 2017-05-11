import Event from '../event.js';

const TMP_SAVE_KEY = 'sd_tmp_save';
const PREFIX_SAVE_KEY = 'sd_save_';

class DataManage {
    getSaveKey(title) {
        return PREFIX_SAVE_KEY + title;
    }
    getTmpSaveKey() {
        return TMP_SAVE_KEY;
    }
    saveTemporal(data) {
        window.localStorage.setItem(this.getTmpSaveKey(), data);
    }
    getTemporal() {
        return window.localStorage.getItem(this.getTmpSaveKey());
    }
    save(title, data) {
        window.localStorage.setItem(this.getSaveKey(title), data);
        Event.$emit('saved', title, data);
    }
    get(title) {
        return window.localStorage.getItem(this.getSaveKey(title));
    }
    getAll() {
        let ret = [];
        let keys = Object.keys(window.localStorage);
        for (let i = 0, n = keys.length; i < n; i++) {
            if (keys[i].indexOf(PREFIX_SAVE_KEY) != 0) {
                continue;
            }
            ret.push({
                title: keys[i].slice(8),
                data: window.localStorage.getItem(keys[i])
            });
        }
        return ret;
    }
}

var dataManage = new DataManage();
export default dataManage;
