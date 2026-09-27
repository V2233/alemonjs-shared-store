# benchmarks 性能测试

```bash
yarn install

yarn bench              # 跑全部
yarn bench write        # 只跑写入
yarn bench read         # 只跑读取
yarn bench mixed        # 只跑混合
yarn bench multibot     # 只跑跨库回退
yarn bench isolation    # 只跑隔离模式对比
```

> 需要删除测试数据则搜索`rmSync`所在行取消注释