import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@lumion/ui";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@lumion/ui';

interface ActivityDataPoint { day: string; value: number; }
interface ActivityChartCardProps {
  title?: string; totalValue: string; data: ActivityDataPoint[];
  className?: string; dropdownOptions?: string[];
  trend?: number; period?: string;
}

export const ActivityChartCard = ({
  title = "Activity", totalValue, data, className,
  dropdownOptions = ["Weekly", "Monthly", "Yearly"],
  trend, period,
}: ActivityChartCardProps) => {
  const [selectedRange, setSelectedRange] = React.useState(dropdownOptions[0] || "");
  const maxValue = React.useMemo(() => data.reduce((max, item) => (item.value > max ? item.value : max), 0), [data]);

  const chartVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const barVariants = {
    hidden: { scaleY: 0, opacity: 0, transformOrigin: "bottom" },
    visible: { scaleY: 1, opacity: 1, transformOrigin: "bottom", transition: { duration: 0.5 } }
  };

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm">
                {selectedRange}<ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {dropdownOptions.map(option => (
                <DropdownMenuItem key={option} onSelect={() => setSelectedRange(option)}>{option}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="flex flex-col">
            <p className="text-5xl font-bold tracking-tighter text-foreground">{totalValue}</p>
            <CardDescription className="text-xs text-muted-foreground">
              {trend !== undefined && period ? `${trend > 0 ? '+' : ''}${trend}% from last ${period.toLowerCase()}` : ''}
            </CardDescription>
          </div>
          <motion.div key={selectedRange} className="flex h-28 w-full items-end justify-between gap-2"
            variants={chartVariants} initial="hidden" animate="visible">
            {data.map((item, index) => (
              <div key={index} className="flex h-full w-full flex-col items-center justify-end gap-2">
                <motion.div className="w-full rounded-sm bg-foreground/80"
                  style={{ height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                  variants={barVariants} />
                <span className="text-xs text-muted-foreground">{item.day}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
};
