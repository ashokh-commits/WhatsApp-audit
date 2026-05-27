import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";
import CTWAImportWizard from "./CTWAImportWizard";

export default function CTWAImportPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-g6-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar title="Import Meta Ads Data" />
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-2xl">
            <p className="mb-6 font-body text-sm text-gray-400">
              Upload a Meta Ads Manager CSV or XLSX export to cross-reference ad spend with
              WhatsApp CTWA conversations. This enriches the Paid Conversation Performance score.
            </p>
            <CTWAImportWizard />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
