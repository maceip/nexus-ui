const ReviewContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex w-full flex-col items-center justify-center rounded-xl bg-white dark:bg-background h-[412px] p-10">
      {children}
    </div>
  );
};

export default ReviewContainer;
