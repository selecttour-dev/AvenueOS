import { TrendingUp } from "lucide-react";
import ModuleStub from "@/components/ModuleStub";

export default function ForecastPage() {
  return (
    <ModuleStub
      icon={TrendingUp}
      title="პროგნოზები"
      subtitle="ბიზნეს-მოდელი, what-if სცენარები, break-even"
      description="ინტერაქტიული მოდელი: შეცვალე ფასი, სტუმრების რაოდენობა ან ხარჯები და მაშინვე ნახე გავლენა წლიურ მოგებაზე."
      features={[
        "12-თვიანი პროგნოზი სეზონურობის გათვალისწინებით",
        "What-if სლაიდერები (ფასი, ივენთი/თვე, სტუმრები, ხარჯები)",
        "Break-even წერტილი — რამდენი ივენთი სჭირდება ნულს",
        "სენსიტიურობის ანალიზი — რომელი ბერკეტი ცვლის ყველაზე მეტს",
        "მიზნობრივი მოგების კალკულატორი და payback პერიოდი",
      ]}
    />
  );
}
