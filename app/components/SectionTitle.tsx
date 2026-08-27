/**
 * 화면 안의 구역 제목. 오른쪽에 칩이나 버튼을 붙일 수 있다.
 *
 * 포트폴리오·자산 구성 화면이 함께 쓴다. 제목 줄의 여백(mb-3, px-1)과 글자 크기는
 * Skeleton의 TitleSkeleton과 짝이므로, 한쪽을 바꾸면 다른 쪽도 같이 맞춰야 한다.
 */
export default function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold text-gray-900">{children}</h2>
      {action}
    </div>
  );
}
