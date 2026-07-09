import { Settings } from "lucide-react";
import ModuleStub from "@/components/ModuleStub";

export default function SettingsPage() {
  return (
    <ModuleStub
      icon={Settings}
      title="პარამეტრები"
      subtitle="ობიექტის და ბიზნეს-მოდელის პარამეტრები"
      description="ობიექტის ძირითადი მონაცემები და მოდელის საწყისი პარამეტრები, რომლებზეც აშენდება პროგნოზები."
      features={[
        "ობიექტის სახელი, მისამართი, ტევადობა",
        "ნაგულისხმევი ფასი სტუმარზე და კვების ღირებულება",
        "სამიზნე food-cost % და მომსახურე პერსონალის ხარჯი",
        "ობიექტების დამატება / გადარქმევა",
      ]}
    />
  );
}
