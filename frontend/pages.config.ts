import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'

export default defineUniPages({
  globalStyle: {
    navigationStyle: 'custom',
    navigationBarTitleText: '一面 · 数字名片',
    navigationBarBackgroundColor: '#f8f7f4',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f8f7f4',
  },
  easycom: {
    autoscan: true,
    custom: {
      '^(?!z-paging-refresh|z-paging-load-more)z-paging(.*)':
        'z-paging/components/z-paging$1/z-paging$1.vue',
    },
  },
})
