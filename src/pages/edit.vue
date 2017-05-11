<template>
  <div class="wrap">
    <div class="main">
      <div class="content" ref="content">
        <svgview v-model="data"></svgview>
      </div>
    </div>
    <div class="side">
      <div class="menu">
        <a ref="newtab" target="_blank" href="#" @click.stop="openInNewTab">・別タブでSVG表示</a> <a ref="download" href="#" @click.stop="download">・SVGダウンロード</a> <a href="#" @click.stop.prevent="save">・保存</a> <router-link to="/save">・読み込み</router-link></div>
      <div class="editor">
        <editor v-model="input"></editor>
      </div>
    </div>
  </div>
</template>

<style type="text/css">
  .main {
      float: right;
      width: 100%;
      height: 100vh;
      margin-left: -600px;
  }
  .main > .content {
      position: relative;
      width: auto;
      height: 100%;
      margin-left: 600px;
  }
  .side {
      position: relative;
      float: left;
      width: 600px;
      height: 100vh;
  }
  .menu {
      width: 100%;
      height: 30px;
  }
  .editor {
      position: absolute;
      width: 100%;
      top: 30px;
      bottom: 0;
      overflow: scroll;
      border: 1px solid #000;
      background-color: #ffffff;
  }
</style>

<script>
  import Event from '../event.js';
  import DataManage from '../class/data-manage.js';

  export default {
      components: {
          'editor': require('../components/editor.vue'),
          'svgview': require('../components/view.vue')
      },
      data () {
          let input = '';
          let tmp_save = DataManage.getTemporal();
          if (tmp_save) {
              input = tmp_save;
          } else {
              input = `title:シーケンス図
participant Actor1 as A
participant Actor2 as C
participant Actor3 as B
participant Actor4
note right of C:participantで\\nActorの出現順を調整\\nasでalias
A->B:Signal
note over A, B:番号は勝手に付く
B-->C:Signal
C-->>B:
B<->A:両方向
A->A:self
+A->+C:帯付き
+C->*Actor5:途中参加的な
note right of Actor5:participantで指定していなくても\\n登場時点で勝手に追加される
Actor5->-C:帯はネスト出来る
destroy Actor5
-C->-A:`;
          }
          return {
              input: input,
              data: this.convert(input)
          }
      },
      methods: {
          convert: function(input) {
              let count = 1;
              return input.replace(/(.+)->(.+):(.+)/g, function(match, m1, m2, m3) {
                  return m1 + '->' + m2 + ':(' + count++ + ')' + m3;
              });
          },
          toDataURL: function() {
              let svg = this.$refs.content.querySelector('svg');
              let width = parseInt(svg.width.baseVal.value);
              let height = parseInt(svg.height.baseVal.value);
              let data = this.input;
              let xml = '<?xml version="1.0" encoding="utf-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd"><svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" xmlns:xlink="http://www.w3.org/1999/xlink"><source><![CDATA[' + data + ']]></source>' + svg.innerHTML + '</svg>';
              return 'data:image/svg+xml;charset=utf-8;,' + encodeURIComponent(xml);
          },
          openInNewTab: function() {
              this.$refs.newtab.setAttribute('href', this.toDataURL());
          },
          getTitle: function() {
              return this.input.replace(/[\s\S]*[Tt]itle:(.+)[\s\S]*/, '$1');
          },
          download: function() {
              this.$refs.download.setAttribute('download', this.getTitle() + '.svg');
              this.$refs.download.setAttribute('href', this.toDataURL());
          },
          save: function() {
              DataManage.save(this.getTitle(), this.input);
          }
      },
      watch: {
          input: function(val) {
              DataManage.saveTemporal(val);
              this.data = this.convert(val);
          }
      },
      created: function() {
          Event.$on('edit', function(title, data) {
              this.input = data;
          }.bind(this));
      },
      mounted: function() {
      }
  }
</script>
