import DateSelect from "../../components/ui/DateSelect";
import Dropdown from "../../components/ui/Dropdown";
import Input from "../../components/ui/Input";
import Radio from "../../components/ui/Radio";
import Tag from "../../components/ui/Tag";
import IconButton from "../../components/ui/IconButton";
import { FaSearch, FaTimes } from "react-icons/fa";
import { useSearchStore } from '../../store/searchStore';

interface DetailSearchProps {
  onSearch: () => void;
}

export default function DetailSearch({ onSearch }: DetailSearchProps) {
  const {
    keyword, setKeyword,
    category, setCategory,
    sort, setSort,
    startDate, setStartDate,
    endDate, setEndDate,
    period, setPeriod,
    searchRange, setSearchRange,
    historyTags, addHistoryTag, removeHistoryTag, clearHistoryTags
  } = useSearchStore();

  const categoryOptions = [
    { value: "1", label: "카테고리1" },
    { value: "2", label: "카테고리2" },
    { value: "3", label: "카테고리3" },
    { value: "4", label: "카테고리4" }
  ];
  const sortOptions = [
    { value: "latest", label: "최신순" },
    { value: "popular", label: "인기순" },
    { value: "rating", label: "평점순" }
  ];
  const searchRangeOptions = [
    { value: "title", label: "제목만" },
    { value: "content", label: "본문만" },
    { value: "title_content", label: "제목+본문" },
  ];

  const handleClick = () => {
    if (keyword.trim()) addHistoryTag(keyword);
    onSearch();
  };

  return (
    <div>
      {/* 키워드 + 검색 버튼 */}
      <div>
        <Input value={keyword} onChange={e => setKeyword(e.target.value)} />
        <IconButton icon={FaSearch} onClick={handleClick} />
      </div>
      {/* 카테고리 & 정렬 */}
      <div>
        <Dropdown options={categoryOptions} value={category} onChange={e => setCategory(e.target.value)} />
        <Dropdown options={sortOptions} value={sort} onChange={e => setSort(e.target.value)} />
      </div>
      {/* 검색 범위 */}
        <div>
        <Dropdown options={searchRangeOptions} value={searchRange} onChange={e => setSearchRange(e.target.value)} />
        </div>
      {/* 날짜 선택 */}
      <div>
        <DateSelect value={startDate} onChange={setStartDate} />
        <DateSelect value={endDate} onChange={setEndDate} />
      </div>
      {/* 라디오 */}
      <div>
        <Radio name="period" label="1주일" checked={period === "1w"} onChange={() => setPeriod("1w")} />
        <Radio name="period" label="1개월" checked={period === "1m"} onChange={() => setPeriod("1m")} />
        <Radio name="period" label="3개월" checked={period === "3m"} onChange={() => setPeriod("3m")} />
      </div>
      {/* 히스토리 */}
      <div>
        {historyTags.map(tag => (
          <Tag key={tag} label={tag} onRemove={() => removeHistoryTag(tag)} />
        ))}
        {historyTags.length > 0 && (
          <IconButton icon={FaTimes} onClick={() => clearHistoryTags()} />
        )}
      </div>
    </div>
  );
}