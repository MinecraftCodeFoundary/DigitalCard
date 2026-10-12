<script setup lang="ts">
import type { CardTemplate } from '@/api/types'

defineProps<{ template?: CardTemplate }>()
</script>

<template>
  <view class="template-decoration" :class="`decoration-${template || 'signature'}`" aria-hidden="true">
    <template v-if="template === 'festive'">
      <view class="gold-frame" /><view class="window-pattern window-left" /><view class="window-pattern window-right" />
      <view class="gold-rosette">
        <view /><view /><view /><view />
      </view>
    </template>
    <template v-else-if="template === 'business'">
      <view class="business-rays" /><view class="business-ribbon ribbon-one" /><view class="business-ribbon ribbon-two" /><view class="business-glint" />
    </template>
    <template v-else-if="template === 'neon'">
      <view class="neon-ring ring-one" /><view class="neon-ring ring-two" /><view class="neon-grid" /><view class="neon-star star-one" /><view class="neon-star star-two" />
    </template>
    <template v-else-if="template === 'floral'">
      <view class="floral-lines" />
      <view class="flower flower-one">
        <view /><view /><view /><view /><view />
      </view>
      <view class="flower flower-two">
        <view /><view /><view /><view /><view />
      </view>
      <view class="flower flower-three">
        <view /><view /><view /><view /><view />
      </view>
      <view class="leaf leaf-one" /><view class="leaf leaf-two" /><view class="leaf leaf-three" />
    </template>
    <template v-else-if="template === 'obsidian'">
      <view class="obsidian-frame" />
      <view class="obsidian-arches">
        <view /><view /><view />
      </view>
      <view class="obsidian-rule" />
    </template>
    <template v-else-if="template === 'porcelain'">
      <view class="porcelain-wash" />
      <view class="porcelain-rings">
        <view /><view /><view />
      </view>
      <view class="porcelain-seam" />
    </template>
    <template v-else-if="template === 'editorial'">
      <view class="editorial-grid" /><view class="editorial-block" /><view class="editorial-rule" />
      <view class="editorial-marks">
        <view /><view /><view />
      </view>
    </template>
    <template v-else-if="template === 'sunset'">
      <view class="sunset-sun" /><view class="sunset-horizon" /><view class="sunset-hill hill-back" /><view class="sunset-hill hill-front" />
    </template>
    <template v-else-if="template === 'aurora'">
      <view class="aurora-beam beam-one" /><view class="aurora-beam beam-two" /><view class="aurora-dots" /><view class="aurora-coordinate" />
    </template>
    <template v-else-if="template === 'botanical'">
      <view class="botanical-grain" />
      <view class="botanical-sprig">
        <view class="botanical-stem" /><view class="botanical-leaf blade-one" /><view class="botanical-leaf blade-two" /><view class="botanical-leaf blade-three" /><view class="botanical-leaf blade-four" />
      </view>
      <view class="botanical-corner" />
    </template>
  </view>
</template>

<style scoped lang="scss">
.template-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.gold-frame {
  position: absolute;
  inset: 10px;
  border: 1px solid #e7b85c90;
  box-shadow: inset 0 0 0 4px #e7b85c14;
}
.window-pattern {
  position: absolute;
  width: 110px;
  height: 110px;
  border: 5px double #f0cb7890;
  transform: rotate(45deg);
  background:
    repeating-linear-gradient(90deg, transparent 0 20px, #f0cb7845 20px 22px),
    repeating-linear-gradient(transparent 0 20px, #f0cb7845 20px 22px);
}
.window-left {
  left: -67px;
  top: -67px;
}
.window-right {
  right: -67px;
  bottom: -67px;
}
.gold-rosette {
  position: absolute;
  right: 26px;
  top: 55px;
  width: 90px;
  height: 90px;
  opacity: 0.15;
}
.gold-rosette > view {
  position: absolute;
  width: 70px;
  height: 70px;
  left: 10px;
  top: 10px;
  border: 2px solid #ffd986;
}
.gold-rosette > view:nth-child(2) {
  transform: rotate(22.5deg);
}
.gold-rosette > view:nth-child(3) {
  transform: rotate(45deg);
}
.gold-rosette > view:nth-child(4) {
  transform: rotate(67.5deg);
}
.business-rays {
  position: absolute;
  width: 330px;
  height: 330px;
  right: -100px;
  top: -120px;
  border-radius: 50%;
  background: repeating-conic-gradient(from 10deg, transparent 0deg 8deg, #dfbd7012 8deg 9deg);
}
.business-ribbon {
  position: absolute;
  width: 100px;
  height: 340px;
  right: -50px;
  top: 0;
  transform: rotate(42deg);
  border-left: 2px solid #d3ae68;
  background: linear-gradient(90deg, #debb7935, #edc77506);
}
.ribbon-two {
  right: -85px;
  transform: rotate(42deg) translateX(40px);
}
.business-glint {
  position: absolute;
  right: 64px;
  top: 64px;
  width: 5px;
  height: 5px;
  background: #fff1ce;
  box-shadow: 0 0 25px 10px #e9bb6d80;
  transform: rotate(45deg);
}
.neon-ring {
  position: absolute;
  right: -45px;
  top: 25px;
  width: 150px;
  height: 150px;
  border: 2px solid #f791d6;
  border-radius: 50%;
  box-shadow:
    0 0 15px #f158dc88,
    inset 0 0 15px #f158dc88;
  transform: rotate(-35deg) skewY(10deg);
  opacity: 0.55;
}
.ring-two {
  right: -18px;
  top: 70px;
  width: 85px;
  height: 85px;
  border-color: #6cfff0;
  box-shadow:
    0 0 15px #50edec70,
    inset 0 0 15px #50edec70;
}
.neon-grid {
  position: absolute;
  inset: 60% -20% -40%;
  background-image:
    linear-gradient(#c69fff25 1px, transparent 1px), linear-gradient(90deg, #c69fff25 1px, transparent 1px);
  background-size: 22px 22px;
  transform: perspective(180px) rotateX(48deg);
}
.neon-star {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 15px 4px #ffc3ef;
}
.star-one {
  top: 30px;
  right: 85px;
}
.star-two {
  bottom: 38px;
  left: 25px;
  width: 4px;
  height: 4px;
  box-shadow: 0 0 12px 3px #b9fff6;
}
.floral-lines {
  position: absolute;
  inset: 10px;
  border: 1px solid #f9dbb970;
  border-radius: 55px 8px 55px 8px;
}
.flower {
  position: absolute;
  width: 100px;
  height: 100px;
  opacity: 0.85;
}
.flower > view {
  position: absolute;
  width: 45px;
  height: 52px;
  top: 2px;
  left: 28px;
  border-radius: 60% 60% 45% 45%;
  background: linear-gradient(#ffe6d8, #eeb5a480);
  transform-origin: 50% 90%;
  box-shadow: inset 0 0 12px #ffffff35;
}
.flower > view:nth-child(2) {
  transform: rotate(72deg);
}
.flower > view:nth-child(3) {
  transform: rotate(144deg);
}
.flower > view:nth-child(4) {
  transform: rotate(216deg);
}
.flower > view:nth-child(5) {
  transform: rotate(288deg);
}
.flower::after {
  content: '';
  position: absolute;
  left: 39px;
  top: 39px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e6be79;
  box-shadow: 0 0 0 4px #f8d7a133;
}
.flower-one {
  right: -25px;
  top: -30px;
  transform: rotate(15deg);
}
.flower-two {
  left: -40px;
  bottom: -35px;
  transform: scale(0.8) rotate(35deg);
}
.flower-three {
  right: 5px;
  bottom: -50px;
  transform: scale(0.55);
  opacity: 0.5;
}
.leaf {
  position: absolute;
  width: 26px;
  height: 65px;
  border-radius: 0 100% 0 100%;
  background: #d7d5ab75;
}
.leaf-one {
  right: 50px;
  top: 0;
  transform: rotate(-30deg);
}
.leaf-two {
  right: 0;
  top: 68px;
  transform: rotate(25deg);
}
.leaf-three {
  left: 15px;
  bottom: 0;
  transform: rotate(50deg);
}
.obsidian-frame {
  position: absolute;
  inset: 11px;
  border: 1px solid #d9bd862b;
}
.obsidian-arches {
  position: absolute;
  right: -12%;
  top: 18%;
  width: 45%;
  height: 112%;
  border: 1px solid #d9bd864d;
  border-radius: 100px 100px 0 0;
  transform: rotate(-12deg);
}
.obsidian-arches > view {
  position: absolute;
  inset: 12px 11px -12px;
  border: 1px solid #d9bd8638;
  border-radius: inherit;
}
.obsidian-arches > view:nth-child(2) {
  inset: 24px 22px -24px;
}
.obsidian-arches > view:nth-child(3) {
  inset: 36px 33px -36px;
  background: linear-gradient(110deg, #d9bd860a, transparent);
}
.obsidian-rule {
  position: absolute;
  bottom: 12px;
  left: 11px;
  width: 32%;
  height: 2px;
  background: linear-gradient(90deg, #d9bd86a6, #d9bd8610);
}
.porcelain-wash {
  position: absolute;
  right: -10%;
  top: -20%;
  width: 64%;
  height: 150%;
  border-radius: 50%;
  background: radial-gradient(ellipse at 80% 30%, #8ebfb63b, #c4dfd51c 60%, transparent 72%);
}
.porcelain-rings {
  position: absolute;
  right: -25%;
  top: -23%;
  width: 70%;
  height: 170%;
  border: 1px solid #629c8e26;
  border-radius: 50%;
  transform: rotate(-28deg);
}
.porcelain-rings > view {
  position: absolute;
  inset: 15px;
  border: 1px solid #629c8e2b;
  border-radius: 50%;
}
.porcelain-rings > view:nth-child(2) {
  inset: 31px;
}
.porcelain-rings > view:nth-child(3) {
  inset: 47px;
  background: #d6e9e118;
}
.porcelain-seam {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: linear-gradient(90deg, #7da99a5c, #d3e9df26 60%, transparent);
}
.editorial-grid {
  position: absolute;
  right: 0;
  top: 0;
  width: 28%;
  height: 100%;
  background-image:
    linear-gradient(#a33b2b14 1px, transparent 1px), linear-gradient(90deg, #a33b2b14 1px, transparent 1px);
  background-size: 22px 22px;
}
.editorial-block {
  position: absolute;
  right: -8%;
  bottom: 12%;
  width: 30%;
  height: 35%;
  background: #a33b2b24;
}
.editorial-rule {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  height: 1px;
  background: #a33b2b45;
}
.editorial-marks {
  position: absolute;
  right: 11px;
  bottom: 19px;
  display: flex;
  gap: 4px;
}
.editorial-marks > view {
  width: 3px;
  height: 7px;
  background: #a33b2b73;
}
.editorial-marks > view:nth-child(2) {
  height: 11px;
}
.sunset-sun {
  position: absolute;
  right: 9%;
  top: 25%;
  width: 24%;
  padding-bottom: 24%;
  border-radius: 50%;
  background: linear-gradient(160deg, #ffe1b65c, #f7b87b1a);
}
.sunset-horizon {
  position: absolute;
  left: 44%;
  right: 0;
  top: 67%;
  height: 1px;
  background: linear-gradient(90deg, transparent, #ffd6a74d);
}
.sunset-hill {
  position: absolute;
  width: 78%;
  height: 65%;
  border-radius: 50% 50% 0 0;
  border-top: 1px solid #ffd5ab38;
}
.hill-back {
  right: -32%;
  bottom: -29%;
  background: #f4b58c17;
  transform: rotate(-16deg);
}
.hill-front {
  right: -17%;
  bottom: -47%;
  background: #5b2b2438;
  transform: rotate(13deg);
}
.aurora-beam {
  position: absolute;
  width: 31%;
  height: 180%;
  top: -42%;
  right: -2%;
  transform: rotate(31deg) skewY(-15deg);
  border-left: 1px solid #9df8d14d;
  background: linear-gradient(90deg, #71ead128, #66bad80d 68%, transparent);
}
.beam-two {
  width: 17%;
  right: 18%;
  transform: rotate(31deg) skewY(-15deg) translateY(-15px);
  border-color: #77bce92e;
  background: linear-gradient(90deg, #71aeea1f, #71ead108 55%, transparent);
}
.aurora-dots {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 25%;
  height: 29%;
  background-image: radial-gradient(#8ce9d642 1px, transparent 1px);
  background-size: 9px 9px;
}
.aurora-coordinate {
  position: absolute;
  left: 12px;
  bottom: 12px;
  width: 14px;
  height: 14px;
  border-left: 1px solid #8ce9d669;
  border-bottom: 1px solid #8ce9d669;
}
.botanical-grain {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(#e4e6be0c 1px, transparent 1px);
  background-size: 5px 5px;
}
.botanical-sprig {
  position: absolute;
  right: -1%;
  bottom: -13%;
  width: 35%;
  height: 100%;
  transform: rotate(24deg);
  opacity: 0.32;
}
.botanical-stem {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 1px;
  height: 92%;
  background: #c8d5a8;
}
.botanical-leaf {
  position: absolute;
  width: 37%;
  height: 28%;
  border: 1px solid #d6dfb6;
  background: linear-gradient(130deg, #c8d5a842, #c8d5a814);
  border-radius: 0 90% 0 90%;
}
.blade-one {
  left: 13%;
  top: 13%;
  transform: rotate(-8deg);
}
.blade-two {
  left: 51%;
  top: 28%;
  transform: scaleX(-1) rotate(-8deg);
}
.blade-three {
  left: 13%;
  top: 48%;
  transform: rotate(-8deg);
}
.blade-four {
  left: 51%;
  top: 65%;
  transform: scaleX(-1) rotate(-8deg);
}
.botanical-corner {
  position: absolute;
  left: 11px;
  top: 11px;
  width: 19px;
  height: 19px;
  border-left: 1px solid #c8d5a84d;
  border-top: 1px solid #c8d5a84d;
}
</style>
