<template>
  <div class="content" ref="content">
    <input type="checkbox" v-model="isShowAll"> 全体を表示
    <div id="viewer" ref="viewer">
      <div id="diagram" ref="diagram"></div>
    </div>
  </div>
</template>

<style>
  div#viewer {
      position: absolute;
      width: 100%;
      top: 30px;
      bottom: 0;
      overflow: scroll;
      border: 1px solid #000;
      background-color: #ffffff;
  }
  div#diagram {
      overflow: hidden;
  }
  div#diagram > svg {
      position: absolute;
      top: 0;
      left: 0;
  }
  div#diagram > svg .selected {
      filter: url(#sequenceEditing);
  }
  div#diagram > svg [data-lineno]:hover {
      filter: url(#sequenceHover);
  }
</style>

<script>
  import Event from '../event.js';

  export default {
      props: [
          'value'
      ],
      data: function() {
          return {
              prev: '',
              isShowAll: false,
              selectedLine: 1,
              scale: 1,
          }
      },
      methods: {
          selectLine: function(lineno) {
              let target = null;
              let svg = this.$refs.diagram && this.$refs.diagram.querySelector('svg');
              if (svg) {
                  let selected = svg.querySelectorAll('.selected:not([data-lineno="'+lineno+'"])');
                  for (var i = 0, n = selected.length; i < n; i++) {
                      selected[i].classList.remove('selected');
                  }
                  target = svg.querySelector('[data-lineno="'+lineno+'"]');
                  if (target) {
                      target.classList.add('selected');
                  }
              }
              return target;
          },
          update: function() {
              let svg = this.$refs.diagram && this.$refs.diagram.querySelector('svg');
              if (svg) {
                  let svgWidth = parseInt(svg.width.baseVal.value);
                  let svgHeight = parseInt(svg.height.baseVal.value);
                  let conWidth = this.$refs.viewer.clientWidth;
                  let conHeight = this.$refs.viewer.clientHeight;
                  let divWidth = conWidth/svgWidth;
                  let divHeight = conHeight/svgHeight;
                  this.scale = divWidth;
                  if (this.isShowAll) {
                      if (divWidth > divHeight) {
                          this.scale = divHeight;
                      }
                  }
                  if (this.scale > 1) {
                      this.scale = 1;
                  }
                  if (this.scale <= 1 && this.scale > 0) {
                      this.$refs.diagram.style.width = svgWidth + 'px';
                      this.$refs.diagram.style.height = svgHeight + 'px';
                      this.$refs.diagram.style.transform = 'translate(-'+svgWidth/2+'px, -'+svgHeight/2+'px) scale('+this.scale+') translate('+svgWidth/2+'px, '+svgHeight/2+'px)';
                  }
                  this.selectLine(this.selectedLine);

                  let filter = svg.querySelector('filter#sequenceEditing');
                  if (!filter) {
                      let defs = svg.querySelector('defs');
                      defs.innerHTML += `
<filter id="sequenceEditing" height="130%" filterUnits="userSpaceOnUse">
  <feGaussianBlur in="SourceAlpha" stdDeviation="3"></feGaussianBlur>
  <feOffset dx="0" dy="0" result="offsetblur"></feOffset>
  <feFlood flood-color="green"></feFlood>
  <feComposite in2="offsetblur" operator="in"></feComposite>
  <feMerge>
    <feMergeNode></feMergeNode>
    <feMergeNode in="SourceGraphic"></feMergeNode>
  </feMerge>
</filter>
<filter id="sequenceHover" height="130%" filterUnits="userSpaceOnUse">
  <feGaussianBlur in="SourceAlpha" stdDeviation="3"></feGaussianBlur>
  <feOffset dx="0" dy="0" result="offsetblur"></feOffset>
  <feFlood flood-color="blue"></feFlood>
  <feComposite in2="offsetblur" operator="in"></feComposite>
  <feMerge>
    <feMergeNode></feMergeNode>
    <feMergeNode in="SourceGraphic"></feMergeNode>
  </feMerge>
</filter>
`;
                  }
              }
              if (this.prev != this.value) {
                  try {
                      this.prev = this.value;
                      let diagram = Diagram.parse(this.value);
                      this.$refs.diagram.innerHTML = '';
                      diagram.drawSVG('diagram', {
                          theme: 'simple'
                      });
                      Event.$emit('input_error', null);
                  } catch(error) {
                      Event.$emit('input_error', error);
                      console.error(error);
                  }
              }
              window.requestAnimationFrame(this.update.bind(this));
          },
          findLineno: function(root, target) {
              if (root == target) {
                  return -1;
              }
              if (target.dataset.lineno != void 0) {
                  return target.dataset.lineno;
              }
              return this.findLineno(root, target.parentNode);
          }
      },
      watch: {
          isShowAll: function(isShowAll) {
              if (isShowAll) {
                  this.$refs.viewer.scrollLeft = 0;
                  this.$refs.viewer.scrollTop = 0;
              }
          }
      },
      mounted: function() {
          this.update();

          this.$nextTick(function() {
              Event.$on('select_line', function(lineno) {
                  if (this.selectedLine == lineno) {
                      return;
                  }
                  this.selectedLine = lineno;
                  let target = this.selectLine(lineno);
                  if (target) {
                      let viewerRect = this.$refs.viewer.getBoundingClientRect();
                      let targetRect = target.getBoundingClientRect();
                      let top = targetRect.top - viewerRect.top;
                      let def1 = top + targetRect.height + 50 - viewerRect.height;
                      if (def1 > 0) {
                          this.$refs.viewer.scrollTop += def1;
                      } else {
                          let def2 = top - 50;
                          if (def2 < 0) {
                              this.$refs.viewer.scrollTop += def2;
                          }
                      }
                  }
              }.bind(this));

              this.$refs.diagram.addEventListener('click', function(event) {
                  let lineno = this.findLineno(this.$refs.diagram, event.srcElement);
                  if (lineno == -1) {
                      return;
                  }
                  Event.$emit('select_line', lineno);
              }.bind(this));
          });
      }
  }
</script>
