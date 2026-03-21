"use client";

import { Typography } from "antd";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const { Text } = Typography;

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// 모듈 레벨 캐시 — 최초 1회만 fetch
let cachedData: object | null = null;
let fetchPromise: Promise<object | null> | null = null;

function getAnimationData(): Promise<object | null> {
  if (cachedData) return Promise.resolve(cachedData);
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("https://assets3.lottiefiles.com/packages/lf20_wnqlfojb.json")
    .then((r) => r.json())
    .then((data) => { cachedData = data; return data; })
    .catch(() => null);
  return fetchPromise;
}

interface EmptyLottieProps {
  description?: string;
}

export default function EmptyLottie({ description = "데이터가 없습니다." }: EmptyLottieProps) {
  const [animationData, setAnimationData] = useState<object | null>(cachedData);

  useEffect(() => {
    if (cachedData) return;
    getAnimationData().then(setAnimationData);
  }, []);

  if (!animationData) {
    return (
      <div style={{ textAlign: "center", padding: "40px 0" }}>
        <Text type="secondary">{description}</Text>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <Lottie
        animationData={animationData}
        loop
        style={{ width: 200, height: 200, margin: "0 auto" }}
      />
      <Text type="secondary" style={{ fontSize: 13 }}>
        {description}
      </Text>
    </div>
  );
}
