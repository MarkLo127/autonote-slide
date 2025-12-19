"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Typography,
  Card,
  Row,
  Col,
  Tabs,
  Input,
  Button,
  message,
  Space,
  Tag,
} from "antd";
import {
  FileTextOutlined,
  RobotOutlined,
  TagsOutlined,
  BarChartOutlined,
  CloudOutlined,
  FilePdfOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { saveApiSettings, loadApiSettings } from "@/lib/storage";

const { Title, Paragraph, Text } = Typography;

const features = [
  {
    icon: <FileTextOutlined style={{ fontSize: 28, color: "#6366f1" }} />,
    title: "PDF 文件解析",
    description: "支援多種格式 PDF 文件，自動提取文字內容與結構資訊",
  },
  {
    icon: <RobotOutlined style={{ fontSize: 28, color: "#8b5cf6" }} />,
    title: "AI 智能摘要",
    description: "採用先進 LLM 技術，自動生成高質量逐頁摘要與全局總結",
  },
  {
    icon: <TagsOutlined style={{ fontSize: 28, color: "#ec4899" }} />,
    title: "重點整理",
    description: "提取關鍵結論、核心數據、風險與行動建議",
  },
  {
    icon: <BarChartOutlined style={{ fontSize: 28, color: "#10b981" }} />,
    title: "關鍵字提取",
    description: "自動識別並提取文檔中的重要關鍵詞",
  },
  {
    icon: <CloudOutlined style={{ fontSize: 28, color: "#f59e0b" }} />,
    title: "文字雲視覺化",
    description: "生成美觀的文字雲，直觀呈現文檔重點詞彙",
  },
  {
    icon: <FilePdfOutlined style={{ fontSize: 28, color: "#ef4444" }} />,
    title: "PDF 報告匯出",
    description: "一鍵匯出專業格式的分析報告，方便後續使用與分享",
  },
];

const tabItems = [
  { key: "openai", label: "OpenAI" },
  { key: "gemini", label: "Gemini" },
  { key: "anthropic", label: "Claude" },
  { key: "grok", label: "Grok" },
  { key: "deepseek", label: "DeepSeek" },
  { key: "qwen", label: "Qwen" },
  { key: "custom", label: "自訂" },
];

const providerInfo: Record<string, { placeholder: string; helpText: string; helpUrl: string }> = {
  openai: {
    placeholder: "sk-...",
    helpText: "在 OpenAI Platform 取得您的 API Key",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  gemini: {
    placeholder: "AIza...",
    helpText: "在 Google AI Studio 取得您的 API Key",
    helpUrl: "https://makersuite.google.com/app/apikey",
  },
  anthropic: {
    placeholder: "sk-ant-...",
    helpText: "在 Anthropic Console 取得您的 API Key",
    helpUrl: "https://console.anthropic.com/",
  },
  grok: {
    placeholder: "xai-...",
    helpText: "在 xAI Console 取得您的 API Key",
    helpUrl: "https://console.x.ai/",
  },
  deepseek: {
    placeholder: "sk-...",
    helpText: "在 DeepSeek Platform 取得您的 API Key",
    helpUrl: "https://platform.deepseek.com/api_keys",
  },
  qwen: {
    placeholder: "sk-...",
    helpText: "在阿里雲百煉控制台取得您的 API Key",
    helpUrl: "https://dashscope.console.aliyun.com/apiKey",
  },
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [grokKey, setGrokKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [qwenKey, setQwenKey] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const settings = loadApiSettings();
    setOpenaiKey(settings.openai_api_key);
    setGeminiKey(settings.gemini_api_key);
    setAnthropicKey(settings.anthropic_api_key);
    setGrokKey(settings.grok_api_key);
    setDeepseekKey(settings.deepseek_api_key);
    setQwenKey(settings.qwen_api_key);
    setCustomKey(settings.custom_api_key);
    setCustomUrl(settings.custom_base_url);
  }, []);

  const handleSave = () => {
    saveApiSettings({
      openai_api_key: openaiKey,
      gemini_api_key: geminiKey,
      anthropic_api_key: anthropicKey,
      grok_api_key: grokKey,
      deepseek_api_key: deepseekKey,
      qwen_api_key: qwenKey,
      custom_api_key: customKey,
      custom_base_url: customUrl,
    });
    messageApi.success("設定已儲存");
  };

  const getKeyValue = (provider: string) => {
    switch (provider) {
      case "openai": return openaiKey;
      case "gemini": return geminiKey;
      case "anthropic": return anthropicKey;
      case "grok": return grokKey;
      case "deepseek": return deepseekKey;
      case "qwen": return qwenKey;
      default: return "";
    }
  };

  const setKeyValue = (provider: string, value: string) => {
    switch (provider) {
      case "openai": setOpenaiKey(value); break;
      case "gemini": setGeminiKey(value); break;
      case "anthropic": setAnthropicKey(value); break;
      case "grok": setGrokKey(value); break;
      case "deepseek": setDeepseekKey(value); break;
      case "qwen": setQwenKey(value); break;
    }
  };

  const renderApiKeyInput = () => {
    if (activeTab === "custom") {
      return (
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong>API Base URL</Text>
            <Input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Text strong>API Key</Text>
            <Input.Password
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="您的 API Key"
              style={{ marginTop: 8 }}
            />
          </div>
          <Text type="secondary">適用於自訂的 OpenAI 相容端點</Text>
        </Space>
      );
    }

    const info = providerInfo[activeTab];
    if (!info) return null;

    return (
      <div>
        <Text strong>{tabItems.find(t => t.key === activeTab)?.label} API Key</Text>
        <Input.Password
          value={getKeyValue(activeTab)}
          onChange={(e) => setKeyValue(activeTab, e.target.value)}
          placeholder={info.placeholder}
          style={{ marginTop: 8 }}
        />
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: isMobile ? 12 : 14 }}>
          在{" "}
          <a href={info.helpUrl} target="_blank" rel="noopener noreferrer">
            {info.helpText.split("在 ")[1]?.split(" 取得")[0] || info.helpText}
          </a>{" "}
          取得您的 API Key
        </Paragraph>
      </div>
    );
  };

  return (
    <div className="hero-gradient" style={{ minHeight: "100vh" }}>
      {contextHolder}
      
      {/* Hero Section */}
      <section style={{ 
        padding: isMobile ? "32px 16px 24px" : "64px 24px 48px", 
        maxWidth: 1200, 
        margin: "0 auto", 
        textAlign: "center" 
      }}>
        <Tag color="purple" style={{ marginBottom: isMobile ? 16 : 24, padding: "4px 12px", fontSize: isMobile ? 12 : 14 }}>
          ✨ AI 驅動的智慧文檔處理平台
        </Tag>
        
        <Title level={1} style={{ marginBottom: isMobile ? 16 : 24 }}>
          <span className="gradient-text" style={{ fontSize: isMobile ? "1.75rem" : "clamp(2.5rem, 5vw, 3.5rem)" }}>
            AutoNote &amp; Slide
          </span>
        </Title>
        
        <Title level={isMobile ? 5 : 3} style={{ fontWeight: 400, color: "#64748b", marginBottom: isMobile ? 12 : 16 }}>
          智能文件分析與摘要生成系統
        </Title>
        
        <Paragraph style={{ fontSize: isMobile ? 14 : 16, color: "#64748b", maxWidth: 600, margin: isMobile ? "0 auto 24px" : "0 auto 48px" }}>
          自動將 PDF 文件轉換為結構化的摘要報告，支援多語言文檔分析。
          {!isMobile && "一鍵生成逐頁重點、關鍵字提取、文字雲視覺化。"}
        </Paragraph>
      </section>

      {/* Features Section */}
      <section style={{ padding: isMobile ? "0 16px 32px" : "0 24px 48px", maxWidth: 1200, margin: "0 auto" }}>
        <Title level={isMobile ? 4 : 2} style={{ textAlign: "center", marginBottom: isMobile ? 20 : 32 }}>
          核心功能
        </Title>
        <Row gutter={[isMobile ? 12 : 24, isMobile ? 12 : 24]}>
          {features.map((feature, index) => (
            <Col xs={12} sm={12} lg={8} key={index}>
              <Card
                hoverable
                className="hover-lift"
                style={{
                  height: "100%",
                  borderRadius: isMobile ? 12 : 16,
                  border: "1px solid #e2e8f0",
                }}
                styles={{ body: { padding: isMobile ? 16 : 24 } }}
              >
                <div style={{ marginBottom: isMobile ? 8 : 16 }}>{feature.icon}</div>
                <Title level={5} style={{ marginBottom: 4, fontSize: isMobile ? 14 : 16 }}>
                  {feature.title}
                </Title>
                {!isMobile && <Text type="secondary" style={{ fontSize: 14 }}>{feature.description}</Text>}
              </Card>
            </Col>
          ))}
        </Row>
      </section>

      {/* API Settings Section */}
      <section style={{ padding: isMobile ? "0 16px 32px" : "0 24px 64px", maxWidth: 900, margin: "0 auto" }}>
        <Card
          className="glass-card-strong"
          style={{ borderRadius: isMobile ? 16 : 24, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.12)" }}
          styles={{ body: { padding: isMobile ? 16 : 32 } }}
        >
          <Title level={isMobile ? 5 : 3} style={{ marginBottom: 8 }}>
            API 設定
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: isMobile ? 16 : 24, fontSize: isMobile ? 13 : 14 }}>
            請設定您的 LLM API Key，以便開始分析文件
          </Paragraph>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size={isMobile ? "small" : "middle"}
            style={{ marginBottom: isMobile ? 16 : 24 }}
            tabBarGutter={isMobile ? 0 : undefined}
          />

          {renderApiKeyInput()}

          <div style={{ marginTop: isMobile ? 16 : 24 }}>
            <Button
              type="primary"
              onClick={handleSave}
              className="gradient-button"
              block={isMobile}
              style={{ height: isMobile ? 36 : 40, paddingLeft: 24, paddingRight: 24 }}
            >
              儲存設定
            </Button>
          </div>
        </Card>
      </section>

      {/* CTA Section */}
      <section style={{ padding: isMobile ? "0 16px 48px" : "0 24px 96px", textAlign: "center" }}>
        <Link href="/analyze">
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            className="gradient-button"
            block={isMobile}
            style={{
              height: isMobile ? 48 : 56,
              paddingLeft: isMobile ? 24 : 48,
              paddingRight: isMobile ? 24 : 48,
              fontSize: isMobile ? 16 : 18,
              fontWeight: 600,
              borderRadius: 12,
              maxWidth: isMobile ? "100%" : "auto",
            }}
          >
            開始分析
          </Button>
        </Link>
      </section>
    </div>
  );
}