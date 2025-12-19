"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layout, Menu, Typography, Drawer, Button } from "antd";
import { HomeOutlined, FileSearchOutlined, FileTextOutlined, MenuOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";

const { Header: AntHeader } = Layout;
const { Title, Text } = Typography;

export function Header() {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const selectedKey = pathname === "/" ? "home" : pathname === "/analyze" ? "analyze" : "";

  const menuItems: MenuProps["items"] = [
    {
      key: "home",
      icon: <HomeOutlined />,
      label: <Link href="/" onClick={() => setDrawerOpen(false)}>首頁</Link>,
    },
    {
      key: "analyze",
      icon: <FileSearchOutlined />,
      label: <Link href="/analyze" onClick={() => setDrawerOpen(false)}>分析</Link>,
    },
  ];

  return (
    <>
      <AntHeader
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "0 16px" : "0 24px",
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(226, 232, 240, 0.5)",
          height: isMobile ? 56 : 64,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, textDecoration: "none" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: isMobile ? 32 : 40,
              height: isMobile ? 32 : 40,
              borderRadius: isMobile ? 8 : 12,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
              flexShrink: 0,
            }}
          >
            <FileTextOutlined style={{ fontSize: isMobile ? 16 : 20, color: "white" }} />
          </div>
          <div>
            <Title
              level={5}
              style={{
                margin: 0,
                fontSize: isMobile ? 14 : 16,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
              }}
            >
              AutoNote &amp; Slide
            </Title>
            {!isMobile && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                智慧文檔處理平台
              </Text>
            )}
          </div>
        </Link>

        {isMobile ? (
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20 }} />}
            onClick={() => setDrawerOpen(true)}
          />
        ) : (
          <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{
              background: "transparent",
              borderBottom: "none",
              marginLeft: 24,
            }}
          />
        )}
      </AntHeader>

      {/* Mobile Drawer Menu */}
      <Drawer
        title="選單"
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={280}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="vertical"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{ border: "none" }}
        />
      </Drawer>
    </>
  );
}
