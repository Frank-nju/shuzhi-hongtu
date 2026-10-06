# 小程序云存储文件

`route/route-geometry-v1.json` 是从网页端道路几何缓存压缩生成的小程序数据文件，不会进入发布包。

同步与上传：

1. 在仓库根目录执行 `npm --prefix miniprogram run sync:route-geometry`。
2. 在微信开发者工具的云开发控制台进入“云存储”。
3. 新建 `route` 文件夹，将 `cloud-assets/route/route-geometry-v1.json` 上传为 `route/route-geometry-v1.json`。

小程序会通过云文件 ID 下载并在本次启动期间缓存。下载失败或个别道路段缺失时，地图自动使用虚线直线示意。
