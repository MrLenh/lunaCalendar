import { useLocalSearchParams, useRouter } from "expo-router";
import { EventForm } from "../../components/EventForm";
import * as api from "../../lib/api";
import type { NewEventInput } from "../../lib/api";

export default function NewEventScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();

  const handleSubmit = async (input: NewEventInput) => {
    await api.createEvent(input);
    router.back();
  };

  return <EventForm defaultDate={params.date} submitLabel="Tạo sự kiện" onSubmit={handleSubmit} />;
}
