"use client";

import { CommitGraph, type Commit } from "@/components/nexus-ui/commit-graph";

const commits: Commit[] = [
  {
    hash: "8e9a9cd76c16f50aa15a719d2dca4fc781df2dc4",
    message: "Merge branch 'feature/activity-graph'",
    author: {
      name: "Maya Chen",
      avatarUrl: "https://avatars.githubusercontent.com/u/10137?v=4",
    },
    date: "2026-04-20T18:12:00.000Z",
    parents: [
      "d1a4c68cb8bbd7fa936858f22b8f17eea90d6d0d",
      "ac30b2f5849485c7a5d5ff8891c3f4143347d8fa",
    ],
    refs: ["main", "origin/main"],
  },
  {
    hash: "d1a4c68cb8bbd7fa936858f22b8f17eea90d6d0d",
    message: "Polish repo card stats row",
    author: {
      name: "Jon Bell",
      avatarUrl: "https://avatars.githubusercontent.com/u/810438?v=4",
    },
    date: "2026-04-20T14:33:00.000Z",
    parents: ["57429a70cbcb548e61168fccf5d4d13ffb17f0d3"],
    refs: ["release"],
  },
  {
    hash: "ac30b2f5849485c7a5d5ff8891c3f4143347d8fa",
    message: "Add side-scrolling activity graph loading mode",
    author: {
      name: "Priya Patel",
      avatarUrl: "https://avatars.githubusercontent.com/u/17232?v=4",
    },
    date: "2026-04-20T13:01:00.000Z",
    parents: ["57429a70cbcb548e61168fccf5d4d13ffb17f0d3"],
    refs: ["feature/activity-graph"],
    tag: "beta",
  },
  {
    hash: "57429a70cbcb548e61168fccf5d4d13ffb17f0d3",
    message: "Introduce file tree and commit graph docs",
    author: {
      name: "Alex Rivera",
      avatarUrl: "https://avatars.githubusercontent.com/u/2621?v=4",
    },
    date: "2026-04-19T11:40:00.000Z",
    parents: ["b11af5d8136a9933bb80cdc458fc44ad8d0f6f2c"],
  },
  {
    hash: "b11af5d8136a9933bb80cdc458fc44ad8d0f6f2c",
    message: "Bootstrap repository insights section",
    author: {
      name: "Nina Gomez",
      avatarUrl: "https://avatars.githubusercontent.com/u/279?v=4",
    },
    date: "2026-04-18T08:10:00.000Z",
    parents: [],
  },
];

export default function CommitGraphDefault() {
  return <CommitGraph commits={commits} />;
}
