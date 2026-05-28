import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import Footer from "@/components/layout/Footer";
import NewClientForm from "./NewClientForm";

export default function NewClientPage() {
  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-g6-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col md:overflow-hidden">
        <TopBar title="Add Client" />
        <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6">
          <div className="mx-auto max-w-lg">
            <NewClientForm />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
