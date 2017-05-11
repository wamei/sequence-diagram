import VueRouter from 'vue-router';

const Edit = require('./pages/edit.vue');
const Save = require('./pages/save.vue');

const router = new VueRouter({
    //mode: 'history',
    saveScrollPosition: true,
    routes: [
        { path: '/', component: Edit },
        { path: '/edit', component: Edit },
        { path: '/save', component: Save },
    ]
});

export default router;
