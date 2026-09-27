**环境**：Node v22.19.0，win32 x64

## Smoke Test

| 项 | 结果 | 预期 |
|---|---|---|
| 实例数 | 1 | 1 |
| 群成员数 | 1 | 1 |
| getGroupMember 命中 | 是 | 是 |
| 消息数 | 1 | 1 |
| countMessages | 1 | 1 |
| removeMessage | true | true |
| 撤回后消息数 | 0 | 0 |
| event.db 大小 | 4096 字节 | — |

## 群 / 成员 / 用户 Benchmark

*群数：100，每群成员：200，总成员：20000*

| 操作 | 次数 | 耗时 | 吞吐 | 单次耗时 |
|---|---|---|---|---|
| setGroupMember（内存，await） | 20,000 | 61.0 ms | 327,845 ops/s | 3.05 us/op |
| flush（落库） | 20,000 | 448.0 ms | 44,645 ops/s | 22.40 us/op |
| getGroup（DB 回源） | 100 | 44.9 ms | 2,227 ops/s | 449.06 us/op |
| getGroup（LRU 命中） | 10,000 | 10.3 ms | 966,268 ops/s | 1.03 us/op |
| getGroupMember（LRU 命中） | 20,000 | 23.4 ms | 856,205 ops/s | 1.17 us/op |
| findMember（带 groupId，命中） | 20,000 | 20.7 ms | 966,482 ops/s | 1.03 us/op |
| findMember（不带 groupId，userIndex） | 20,000 | 20.3 ms | 986,592 ops/s | 1.01 us/op |
| getUser（主键） | 20,000 | 198.3 ms | 100,874 ops/s | 9.91 us/op |
| getUsers（500 个 IN） | 200 | 193.8 ms | 1,032 ops/s | 969.16 us/op |

- 写入后内存：heap 7.6 MB, rss 23.8 MB
- 最终内存：heap 7.0 KB, rss 48.6 MB

## 消息 Benchmark

*群数：50，每群消息：2000，总消息：100000*

| 操作 | 次数 | 耗时 | 吞吐 | 单次耗时 |
|---|---|---|---|---|
| appendMessage（纯内存，await） | 100,000 | 173.8 ms | 575,407 ops/s | 1.74 us/op |
| flush（落库） | 100,000 | 2511.1 ms | 39,823 ops/s | 25.11 us/op |
| getMessages（按群，limit 50） | 500 | 108.4 ms | 4,611 ops/s | 216.85 us/op |
| getMessages（群+用户，limit 50） | 500 | 123.8 ms | 4,040 ops/s | 247.51 us/op |
| getMessages（keyword LIKE，含 since） | 10 | 945.9 ms | 11 ops/s | 94,588.98 us/op |
| getMessages（mention LIKE，含 since） | 10 | 176.2 ms | 57 ops/s | 17,616.33 us/op |
| getMessages（onlyAtMe） | 500 | 122.1 ms | 4,096 ops/s | 244.14 us/op |
| getMessages（since 时间范围） | 500 | 43.5 ms | 11,496 ops/s | 86.99 us/op |
| countMessages（按群） | 500 | 81.6 ms | 6,131 ops/s | 163.12 us/op |
| countActiveUsers | 50 | 58.9 ms | 850 ops/s | 1177.05 us/op |
| getMessageById | 1,000 | 13.5 ms | 74,027 ops/s | 13.51 us/op |
| removeMessage（单条） | 1,000 | 255.2 ms | 3,918 ops/s | 255.23 us/op |
| removeMessages（500 个批量） | 20 | 25.4 ms | 786 ops/s | 1271.80 us/op |

- append 后内存：heap 36.8 MB, rss 26.8 MB
- flush 后内存：heap -38,582,744 B, rss 18.1 MB
- 最终内存：heap 220.0 KB, rss 25.2 MB

## 列表查询 Benchmark

*群数：100，每群成员：200，总成员：20000*

| 操作 | 次数 | 耗时 | 吞吐 | 单次耗时 |
|---|---|---|---|---|
| getGroup（100 群，返回 members） | 1,000 | 0.9 ms | 1,151,145 ops/s | 0.87 us/op |
| getUsers（全部，limit 100000） | 10 | 225.8 ms | 44 ops/s | 22,576.47 us/op |
| getUsers（500 个 IN） | 100 | 111.2 ms | 899 ops/s | 1112.38 us/op |
| getAllGroupIds | 100 | 7.2 ms | 13,872 ops/s | 72.09 us/op |
| getGroupMemberCount | 1,000 | 36.1 ms | 27,703 ops/s | 36.10 us/op |

## 多 BotId 跨库回退 Benchmark

*5 个 botId，每个 50 群 × 100 成员*

| 操作 | 次数 | 耗时 | 吞吐 | 单次耗时 |
|---|---|---|---|---|
| getGroupMember（本地 bot0 命中） | 5,000 | 4.9 ms | 1,023,018 ops/s | 0.98 us/op |
| getGroupMember（跨库回退到 bot4） | 5,000 | 14.1 ms | 355,374 ops/s | 2.81 us/op |
| getGroupMember（全 miss） | 1,000 | 2.0 ms | 497,686 ops/s | 2.01 us/op |
| findMember（不带 groupId，跨实例） | 5,000 | 187.2 ms | 26,703 ops/s | 37.45 us/op |

## 隔离模式对比 Benchmark

| 模式 | 操作 | 次数 | 耗时 | 吞吐 | 单次耗时 |
|---|---|---|---|---|---|
| by-bot | seed | — | 457.2 ms | — | — |
| by-bot | 写入 | 20,000 | 48.7 ms | 410,625 ops/s | 2.44 us/op |
| by-bot | 读取 | 20,000 | 25.1 ms | 797,232 ops/s | 1.25 us/op |
| by-platform | seed | — | 447.5 ms | — | — |
| by-platform | 写入 | 20,000 | 43.3 ms | 462,389 ops/s | 2.16 us/op |
| by-platform | 读取 | 20,000 | 30.0 ms | 667,020 ops/s | 1.50 us/op |

## enableMessageStorage 对比 Benchmark

| 模式 | 操作 | 次数 | 耗时 | 吞吐 | 单次耗时 | countMessages |
|---|---|---|---|---|---|---|
| 启用 | appendMessage | 100,000 | 164.3 ms | 608,754 ops/s | 1.64 us/op | 100,000 |
| 关闭 | appendMessage | 100,000 | 48.2 ms | 2,074,611 ops/s | 0.48 us/op | 0 |

## Statement 缓存效果

| 方法 | 缓存前 | 缓存后 | 提升 |
|---|---|---|---|
| getUser | 49.06 us | 9.91 us | 5.0 倍 |
| getMessageById | 65.39 us | 13.51 us | 4.8 倍 |
| getGroupMemberCount | 70.52 us | 36.10 us | 2.0 倍 |
| findMember（跨实例） | 162.71 us | 37.45 us | 4.3 倍 |

## 关键结论

- **内存读操作**：LRU 命中 1 us 级，`findMember` / `getGroupMember` 均在此量级。
- **内存写操作**：`setGroupMember` 3 us，`appendMessage` 1.7 us。
- **flush**：20~25 us/行，SQLite + WAL 正常水平。
- **DB 回源**：单条查询 10~450 us，`getUser` 10 us，`getGroup`（200 成员 JOIN）450 us。
- **Statement 缓存**：读操作提升 4~5 倍，效果明显。
- **消息查询**：`getMessages` 200 us 级，`keyword LIKE` 94 ms（全表扫描，用户不传 `since` 的必然结果）。
- **批量写**：`removeMessages` 500 条 1271 us（2.5 us/条），比单条 `removeMessage` 255 us 快 100 倍。
- **跨库回退**：本地命中 0.98 us，跨库回退 2.81 us，只慢 3 倍。
- **隔离模式**：`by-bot` 与 `by-platform` 性能接近，差异在噪声范围内。
- **消息存储开关**：关闭后 `appendMessage` 快 3.6 倍（0.48 us vs 1.64 us）。