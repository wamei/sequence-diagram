import Vue from 'vue/dist/vue.js';
import VueRouter from 'vue-router';
import App from './app.vue';
import router from './router.js';

Vue.use(VueRouter);
new Vue({
    router,
    render: h => h(App)
}).$mount('#app');
