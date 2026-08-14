/*
 * Temporary compatibility test based on MindAR PR #533.
 *
 * MindAR 1.2.5 registers its A-Frame system before this file loads. Replacing
 * the registered system prototype here means MindAR's own startup lifecycle
 * uses the corrected video/FOV/canvas calculation when it calls _resize().
 * The application does not call _resize() and adds no orientation listeners.
 */
(function applyMindArLandscapeCompatibility() {
  'use strict';

  var AFRAME = window.AFRAME;
  var MindArImageSystem = AFRAME && AFRAME.systems && AFRAME.systems['mindar-image-system'];
  if (!MindArImageSystem || !MindArImageSystem.prototype) return;

  MindArImageSystem.prototype._resize = function () {
    var video = this.video;
    var container = this.container;

    video.setAttribute('width', video.videoWidth);
    video.setAttribute('height', video.videoHeight);

    var videoRatio = video.videoWidth / video.videoHeight;
    var containerRatio = container.clientWidth / container.clientHeight;
    var vw;
    var vh;
    if (videoRatio > containerRatio) {
      vh = container.clientHeight;
      vw = vh * videoRatio;
    } else {
      vw = container.clientWidth;
      vh = vw / videoRatio;
    }

    var proj = this.controller.getProjectionMatrix();
    var inputRatio = this.controller.inputWidth / this.controller.inputHeight;
    var inputAdjust;
    if (inputRatio > containerRatio) {
      inputAdjust = video.width / this.controller.inputWidth;
    } else {
      inputAdjust = video.height / this.controller.inputHeight;
    }

    var videoDisplayHeight;
    if (inputRatio > containerRatio) {
      videoDisplayHeight = container.clientHeight * inputAdjust;
    } else {
      var videoDisplayWidth = container.clientWidth;
      videoDisplayHeight = videoDisplayWidth /
        this.controller.inputWidth * this.controller.inputHeight * inputAdjust;
    }

    var fovAdjust = container.clientHeight / videoDisplayHeight;
    var fov = 2 * Math.atan(1 / proj[5] * fovAdjust) * 180 / Math.PI;
    var near = proj[14] / (proj[10] - 1.0);
    var far = proj[14] / (proj[10] + 1.0);
    var cameraElement = container.getElementsByTagName('a-camera')[0];
    var camera = cameraElement.getObject3D('camera');
    camera.fov = fov;
    camera.near = near;
    camera.far = far;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();

    video.style.top = (-(vh - container.clientHeight) / 2) + 'px';
    video.style.left = (-(vw - container.clientWidth) / 2) + 'px';
    video.style.width = vw + 'px';
    video.style.height = vh + 'px';

    var scene = this.el.sceneEl;
    var canvas = scene.canvas || document.getElementsByClassName('a-canvas')[0];
    canvas.style.position = 'absolute';
    canvas.style.left = '0px';
    canvas.style.top = '0px';
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    scene.renderer.setSize(container.clientWidth, container.clientHeight);
  };
})();
