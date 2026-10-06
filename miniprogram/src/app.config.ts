export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/planner/index',
    'pages/routes/index',
    'pages/landmarks/index',
    'pages/saved/index',
    'pages/route-detail/index',
    'pages/landmark-detail/index',
    'pages/history/index',
    'pages/methodology/index'
  ],
  lazyCodeLoading: 'requiredComponents',
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#fffaf7',
    navigationBarTitleText: '数智-红途',
    navigationBarTextStyle: 'black',
    backgroundColor: '#fffaf7'
  },
  tabBar: {
    color: '#78615a',
    selectedColor: '#da291c',
    backgroundColor: '#fffaf7',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/planner/index', text: '规划' },
      { pagePath: 'pages/landmarks/index', text: '图鉴' },
      { pagePath: 'pages/saved/index', text: '我的' }
    ]
  }
})
