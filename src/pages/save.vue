<template>
  <div class="wrap">
    <router-link to="/">戻る</router-link>
    <ul>
      <li v-for="item in saves">
        <a href="#" @click.stop.prevent="load(item.title)">{{item.title}}</a>
      </li>
    </ul>
  </div>
</template>

<script>
  import Router from '../router.js';
  import Event from '../event.js';
  import DataManage from '../class/data-manage.js';

  export default {
      data () {
          return {
              saves: {},
          }
      },
      methods: {
          load: function(title) {
              Event.$emit('edit', title, this.saves[title].data);
              Router.push('/');
          }
      },
      created: function() {
          Event.$on('saved', function(title, data) {
              this.$set(this.saves, title, {
                  title: title,
                  data: data
              });
          }.bind(this));
          let saves = DataManage.getAll();
          for (let i = 0, n = saves.length; i < n; i++) {
              this.saves[saves[i].title] = saves[i];
          }
      }
  }
</script>
